import { SportsBroadcast, sportsBroadcastStatus, confirmedMatchBroadcasts } from './sports-broadcast.model';
import { Component, computed, input, OnDestroy, OnInit, output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { identifySport, organizeSports, SportName, SportsSource } from './sports-directory.model';
import {
    F1Race, F1Standing, parseF1Calendar, parseF1Standings,
    parseSportsScoreboard, SportsMatch, sportsMatchLabel,
} from './sports-feed.model';

type Tab = { key: string; name: string };
const SPORTS: { name: SportName; icon: string }[] = [
    { name: 'Futebol', icon: 'sports_soccer' },
    { name: 'Automobilismo', icon: 'sports_motorsports' },
    { name: 'Basquete', icon: 'sports_basketball' },
    { name: 'Futebol Americano', icon: 'sports_football' },
    { name: 'Beisebol', icon: 'sports_baseball' },
    { name: 'Hóquei', icon: 'sports_hockey' },
    { name: 'Vôlei', icon: 'sports_volleyball' },
    { name: 'Tênis', icon: 'sports_tennis' },
    { name: 'Handebol', icon: 'sports_handball' },
    { name: 'Lutas', icon: 'sports_mma' },
    { name: 'Outros esportes', icon: 'sports' },
];
const LEAGUES: Record<string, Tab[]> = {
    'Futebol': [
        { key: 'bra.1', name: 'Brasileirão Série A' },
        { key: 'bra.2', name: 'Brasileirão Série B' },
        { key: 'conmebol.libertadores', name: 'Libertadores' },
        { key: 'conmebol.sudamericana', name: 'Sul-Americana' },
        { key: 'fifa.world', name: 'FIFA' },
        { key: 'eng.1', name: 'Premier League' },
        { key: 'esp.1', name: 'La Liga' },
        { key: 'uefa.champions', name: 'Champions League' },
    ],
    'Basquete': [{ key: 'nba', name: 'NBA' }, { key: 'wnba', name: 'WNBA' }],
    'Futebol Americano': [{ key: 'nfl', name: 'NFL' }],
    'Beisebol': [{ key: 'mlb', name: 'MLB' }],
    'Hóquei': [{ key: 'nhl', name: 'NHL' }],
    'Automobilismo': [{ key: 'f1', name: 'Fórmula 1' }],
};
const SCORED_SPORTS = new Set(['Futebol','Basquete','Futebol Americano','Beisebol','Hóquei']);

@Component({
    selector: 'app-sports-directory',
    standalone: true,
    imports: [MatIcon],
    templateUrl: './sports-directory.component.html',
    styleUrls: ['./sports-directory.component.scss'],
})
export class SportsDirectoryComponent implements OnInit, OnDestroy {
    readonly sources = input<readonly SportsSource[]>([]);
    readonly loading = input(false);
    readonly chosen = output<string>();
    readonly broadcasts = input<readonly SportsBroadcast[]>([]);
    readonly watch = output<string>();
    readonly search = signal('');
    readonly selectedSport = signal<SportName>('Futebol');
    readonly selectedTab = signal('__games__');
    readonly selectedF1Section = signal('overview');
    readonly f1Open = signal(false);
    readonly maxVisible = signal(50);
    readonly now = signal(Date.now());
    readonly loadingScores = signal(false);
    readonly staleScores = signal(false);
    readonly scoreAvailable = signal(true);
    readonly scoreChecked = signal(0);
    readonly scoreEvents = signal<SportsMatch[]>([]);
    readonly f1Races = signal<F1Race[]>([]);
    readonly f1Drivers = signal<F1Standing[]>([]);
    readonly f1Teams = signal<F1Standing[]>([]);
    private readonly requestedLeagues = new Map<string, number>();
    private readonly allScores = new Map<string, SportsMatch[]>();
    private refreshTimer?: ReturnType<typeof setInterval>;
    private loadVersion = 0;
    readonly sportsLogo = 'assets/aurora/aurora.png';
    readonly f1Sections = [
        { id: 'overview', label: 'Visão geral' },
        { id: 'drivers', label: 'Pilotos' },
        { id: 'teams', label: 'Equipes' },
        { id: 'next', label: 'Próxima corrida' },
        { id: 'calendar', label: 'Calendário' },
    ];
    currentYear(): number { return new Date().getFullYear(); }
    readonly sports = computed(() => {
        const available = new Set(organizeSports(this.sources()).map(section => section.title));
        available.add('Futebol'); available.add('Automobilismo'); available.add('Basquete');
        return SPORTS.filter(sport => available.has(sport.name));
    });
    readonly availableSources = computed(() =>
        organizeSports(this.sources()).find(s => s.title === this.selectedSport())?.entries || []
    );
    readonly tabs = computed<Tab[]>(() => {
        const sport = this.selectedSport();
        this.scoreEvents(); // register a reactive dependency when the scoreboard finishes loading
        const registered = LEAGUES[sport] || [];
        const actual = this.availableSources().map(source => ({
            key: 'source:' + source.id, name: source.competition,
        }));
        const dedup = new Map<string, Tab>();
        // Only list leagues with public fixtures or matching playlist metadata.
        for (const tab of registered) {
            if (tab.key === 'f1' || this.allScores.get(tab.key)?.length)
                dedup.set(tab.name.toLocaleLowerCase(), tab);
        }
        for (const tab of actual) {
            const title = tab.name.toLocaleLowerCase();
            if (!dedup.has(title)) dedup.set(title, tab);
        }
        return [
            { key: '__live__', name: 'Ao Vivo' },
            { key: '__games__', name: sport === 'Automobilismo' ? 'Eventos' : 'Jogos' },
            ...Array.from(dedup.values()),
        ];
    });
    readonly visibleGames = computed(() => {
        const sport = this.selectedSport();
        const tab = this.selectedTab();
        const words = this.normalized(this.search()).split(' ').filter(Boolean);
        const now = this.now();
        const sorted = this.scoreEvents().filter(match => {
            if (match.sport !== sport) return false;
            if (tab === '__live__' && match.state !== 'live') return false;
            if (tab !== '__games__' && tab !== '__live__' && match.league !== tab) return false;
            if (tab === '__games__' && (match.kickoff < now - 3 * 86400000 ||
                match.kickoff > now + 15 * 86400000)) return false;
            const name = this.normalized(match.home.name + ' ' + match.away.name + ' ' + match.competition);
            return words.every(w => name.includes(w));
        }).sort((a,b) => a.kickoff - b.kickoff);
        return sorted;
    });
    readonly displayedGames = computed(() => this.visibleGames().slice(0, this.maxVisible()));
    readonly matchLinks = computed(() => {
        const broadcasts = this.broadcasts();
        return new Map(this.scoreEvents().map(match =>
            [match.id,confirmedMatchBroadcasts(match,broadcasts)] as const
        ));
    });
    linkedBroadcasts(match: SportsMatch): SportsBroadcast[] {
        return this.matchLinks().get(match.id) || [];
    }
    readonly visibleBroadcasts = computed(() => {
        const sport = this.selectedSport(), tab = this.selectedTab();
        const now = this.now(), words = this.normalized(this.search()).split(' ').filter(Boolean);
        const selectedTitle = (LEAGUES[sport] || []).find(t => t.key === tab)?.name ||
            this.availableSources().find(e => 'source:' + e.id === tab)?.competition || '';
        const tabCompetition = selectedTitle ? identifySport(selectedTitle)?.competition || selectedTitle : '';
        return this.broadcasts().filter(item =>
            item.sport === sport &&
            item.stop >= now - 2 * 3600000 &&
            (tab === '__games__' ||
                tab === '__live__' && sportsBroadcastStatus(item,now) === 'AO VIVO' ||
                (!!tabCompetition && this.normalized(item.competition) === this.normalized(tabCompetition))) &&
            words.every(w => this.normalized(item.title + ' ' + item.channel.name).includes(w))
        ).sort((a,b) => a.start - b.start).slice(0,80);
    });
    broadcastStatus(item: SportsBroadcast): string { return sportsBroadcastStatus(item, this.now()); }
    readonly nextF1Race = computed(() =>
        this.f1Races().find(race => (race.hasTime ? race.date :
            race.date + 86400000) >= this.now() - 3 * 3600000) || null
    );
    readonly selectedSources = computed(() => {
        const tab = this.selectedTab();
        const words = this.normalized(this.search()).split(' ').filter(Boolean);
        const sources = this.availableSources();
        const registered = (LEAGUES[this.selectedSport()] || []).find(x => x.key === tab);
        return sources.filter(item => {
            if (tab.startsWith('source:') && item.id !== tab.slice(7)) return false;
            if (registered && this.normalized(item.competition) !== this.normalized(registered.name)) {
                const matched = identifySport(item.title);
                if (!matched || this.normalized(matched.competition) !== this.normalized(registered.name))
                    return false;
            }
            return words.every(w => this.normalized(item.title).includes(w));
        });
    });

    ngOnInit(): void {
        void this.refresh();
        this.refreshTimer = setInterval(() => {
            this.now.set(Date.now());
            if (SCORED_SPORTS.has(this.selectedSport())) void this.refresh();
        }, 120000);
    }
    ngOnDestroy(): void {
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.loadVersion++;
    }
    private normalized(value: string): string {
        return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
            .toLocaleLowerCase('pt-BR').trim().replace(/\s+/g,' ');
    }
    iconFor(sport: SportName): string {
        return SPORTS.find(x => x.name === sport)?.icon || 'sports';
    }
    selectSport(sport: SportName): void {
        this.selectedSport.set(sport);
        this.selectedTab.set('__games__');
        this.search.set('');
        this.maxVisible.set(50);
        this.f1Open.set(false);
        void this.refresh();
    }
    selectTab(key: string): void {
        this.selectedTab.set(key);
        this.maxVisible.set(50);
        if (key === 'f1') void this.refreshF1();
    }
    status(match: SportsMatch): string { return sportsMatchLabel(match); }
    displayTime(time: number): string {
        return new Date(time).toLocaleTimeString('pt-BR',{ hour:'2-digit',minute:'2-digit' });
    }
    displayDate(time: number): string {
        return new Date(time).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'});
    }
    async refresh(force = false): Promise<void> {
        const sport = this.selectedSport();
        const version = ++this.loadVersion;
        const api = window.electron?.getAuroraSportsFeed;
        this.scoreAvailable.set(!!api);
        if (!api) return;
        if (sport === 'Automobilismo') {
            await this.refreshF1();
            return;
        }
        const leagues = (LEAGUES[sport] || []).filter(x => x.key !== 'f1');
        if (!leagues.length) return;
        this.loadingScores.set(true);
        try {
            // Load a small, explicitly allowlisted set of leagues. The main process
            // caches results; only public league IDs are ever transmitted.
            const results = await Promise.all(leagues.map(async item => {
                const last = this.requestedLeagues.get(item.key) || 0;
                if (!force && Date.now() - last < 120000 && this.allScores.has(item.key))
                    return { key:item.key, matches:this.allScores.get(item.key)!, stale:false, checked:last };
                const response = await api({kind:'scoreboard',league:item.key});
                const matches = response.data ? parseSportsScoreboard(response.data,item.key,sport) : [];
                return {key:item.key, matches, stale:response.stale, checked:response.checked};
            }));
            if (version !== this.loadVersion) return;
            for (const row of results) {
                this.allScores.set(row.key,row.matches);
                if (row.checked) this.requestedLeagues.set(row.key,row.checked);
            }
            this.scoreEvents.set(Array.from(this.allScores.values())
                .reduce((all: SportsMatch[], group) => all.concat(group), []));
            this.staleScores.set(results.some(r=>r.stale));
            this.scoreChecked.set(Math.max(...results.map(r=>r.checked),0));
        } finally {
            if (version === this.loadVersion) this.loadingScores.set(false);
        }
    }
    async refreshF1(): Promise<void> {
        const api = window.electron?.getAuroraSportsFeed;
        if (!api) return;
        const year = new Date().getFullYear();
        const results = await Promise.all([
            api({ kind:'f1',resource:'races',year }),
            api({ kind:'f1',resource:'drivers',year }),
            api({ kind:'f1',resource:'teams',year }),
        ]);
        if (this.selectedSport() !== 'Automobilismo') return;
        this.f1Races.set(parseF1Calendar(results[0].data,year));
        this.f1Drivers.set(parseF1Standings(results[1].data,'drivers'));
        this.f1Teams.set(parseF1Standings(results[2].data,'teams'));
        this.staleScores.set(results.some(r=>r.stale));
    }
}
