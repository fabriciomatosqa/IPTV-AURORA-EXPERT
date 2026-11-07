# Arquitetura e primeira etapa — IPTV AURORA EXPERT

Data da análise: 6 de novembro de 2026. Este documento registra evidências do código-fonte, decisões da primeira etapa e limites da verificação. Os resultados finais de compilação, testes, execução e instalador devem ser consultados no relatório de entrega; a presença de um módulo no código não comprova seu funcionamento com qualquer provedor.

## Origem e referência instalada

A base modificável é o projeto aberto iptvmate em Angular/Electron. O histórico Git e `LICENSE.md` foram preservados. `THIRD_PARTY_NOTICES.md` identifica iptvmate, a base histórica IPTVnator e dependências; a nova identidade não substitui os créditos obrigatórios.

Os diretórios de referência fornecidos contêm outro produto: **TvMate IPTV Player 7.5.4.0**, de Velocity Apps Team, distribuído em MSIX e com componentes Flutter. Essa identidade foi estabelecida por manifesto, recursos PE e inventário estático, conforme [reference-analysis.md](reference-analysis.md). A licença MIT do iptvmate não foi atribuída ao TvMate. Nenhum código, arte, fonte, ícone ou binário do pacote TvMate foi incorporado à AURORA.

Não houve observação das telas do TvMate em execução. Portanto, este trabalho preserva a experiência e os módulos da base aberta; equivalência visual e funcional com o pacote instalado permanece não demonstrada.

## Estrutura e comunicação

| Camada                     | Evidência                                                                                                      | Responsabilidade observada                                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace                  | `package.json`, `nx.json`                                                                                      | Monorepo TypeScript com Nx e pnpm; Angular, Electron, Drizzle, SQLite e bibliotecas de reprodução. As versões declaradas e as efetivamente instaladas devem ser distinguidas pelo lockfile.                                |
| Interface principal        | `apps/web/src/app/app.config.ts`, `app.routes.ts`                                                              | Componentes Angular, carregamento de rotas sob demanda, Angular Material, traduções e efeitos NgRx.                                                                                                                        |
| Estado                     | `libs/m3u-state/src/lib/effects.ts`, `apps/web/src/app/xtream-tauri/stores`, `apps/web/src/app/stalker/stores` | Store/efeitos para M3U e Signal Stores para catálogos, seleção, favoritos, histórico e reprodução de portais. O nome legado `xtream-tauri` permanece como estrutura interna; o backend desktop desta aplicação é Electron. |
| Adaptação de ambiente      | `apps/web/src/app/services/electron.service.ts`, `pwa.service.ts`, `libs/services/src/lib/data.service.ts`     | `DataFactory` escolhe o serviço Electron quando `window.electron` está disponível; há caminhos web/PWA preservados.                                                                                                        |
| Processo principal         | `apps/electron-backend/src/main.ts`, `app/app.ts`                                                              | Nome e perfil, instância única, janela, inicialização de proxy, banco e eventos IPC. O preload expõe operações específicas com isolamento de contexto habilitado na janela.                                                |
| Ponte IPC                  | `apps/electron-backend/src/app/api/main.preload.ts`, `app/events`                                              | Playlist, settings, Xtream, Stalker, EPG, player externo, controle remoto, banco e downloads.                                                                                                                              |
| Persistência               | `libs/shared/database/src/lib/connection.ts`, `schema.ts`, `libs/services/src/lib/playlists.service.ts`        | SQLite/Drizzle para catálogos e dados desktop, com IndexedDB também utilizado para playlists e preferências do renderer.                                                                                                   |
| Componentes compartilhados | `libs/ui/components`, `libs/ui/shared-portals`, `libs/ui/pipes`                                                | Players, listas, EPG, cartões e layouts comuns. Aliases internos, incluindo `@iptvmate/pipes`, são preservados para não quebrar importações.                                                                               |
| Aplicações auxiliares      | `apps/remote-control-web`, `apps/website`                                                                      | Controle remoto web e site informativo existentes. O alvo de instalação inclui a interface de controle remoto; isso não implica publicação do site.                                                                        |

## Telas, navegação e configurações

As rotas abaixo são observadas em `apps/web/src/app/app.routes.ts`, `xtream-tauri/xtream.routes.ts` e `stalker/stalker.routes.ts`.

| Área           | Rotas / componentes                                                        | Organização preservada                                                                                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início         | `/`, `home/home.component.html`, `libs/ui/components/.../recent-playlists` | Cabeçalho, playlists recentes, busca, filtros/ordenação e importação.                                                                                                                                                     |
| Playlist M3U   | `/playlists`, `/playlists/:id`, alias `/iptv`                              | Lista de canais, categorias, favoritos e player.                                                                                                                                                                          |
| Configurações  | `/settings`, `settings/settings.component.html`                            | EPG, player interno/externo, caminho MPV/VLC, reutilização MPV, formato de stream, idioma, tema, legendas, OpenSubtitles, controle remoto/porta e pasta de downloads.                                                     |
| Xtream desktop | `/xtreams/:id`                                                             | Subrotas `live`, `vod`, `series`, categorias/detalhes, `favorites`, `recent`, `search`, `recently-added` e `downloads`. Séries mantêm temporadas e episódios.                                                             |
| Stalker        | `/stalker/:id` e caminho legado `/portals/:id`                             | Subrotas `itv`, `vod`, `series`, categorias, favoritos, recentes, busca e downloads.                                                                                                                                      |
| Ações globais  | `shared/components/header/header.component.html`                           | Adicionar playlist por submenu, favoritos globais, busca global, recentes, filtros e configurações. Layout móvel consolida ações em menu. Links de ajuda/projeto e diálogo Sobre permanecem acessíveis conforme ambiente. |
| Menu nativo    | `apps/electron-backend/src/app/app.ts`                                     | Construção de menus de aplicativo, arquivo, edição, visualização, janela e ajuda. No Windows a barra nativa é ocultada, com navegação principal dentro da interface.                                                      |

Ícones funcionais são principalmente Material Icons e controles dos players. A tipografia base declarada é `Roboto, 'Helvetica Neue', sans-serif` em `apps/web/src/styles.scss`; `m3-theme.scss` define os temas Material claro e escuro. O cabeçalho usa fundo escuro `#131316`, elementos violetas e detalhes verde-água. A primeira etapa adiciona o símbolo AURORA próprio em `assets/aurora`, textos e metadados oficiais, preservando a disposição dos componentes existentes. Não é uma reprodução das artes proprietárias do TvMate.

`services/settings-store.service.ts` usa português e tema escuro como padrões da AURORA, mantendo a escolha de idiomas e tema claro. As traduções ficam em `apps/web/src/assets/i18n`. Os padrões não substituem preferências já gravadas no perfil próprio da AURORA.

## Importação, leitura e atualização

**M3U/M3U8:** os componentes `home/file-upload`, `url-upload` e `text-import`, o parser `iptv-playlist-parser`, `libs/shared/m3u-utils/src/lib/playlist.utils.ts` e `app/events/playlist.events.ts` cobrem arquivo, URL e texto. O objeto da playlist recebe identificador, datas, contagem, itens, favoritos e referência à origem quando aplicável. A atualização de origem por URL ou arquivo e a opção de atualização automática continuam presentes. O seletor de arquivos também oferece extensões PLS/TXT; isso é apenas evidência do filtro, não uma validação de todos os formatos possíveis.

**Xtream Codes:** `home/xtream-code-import`, `xtream-tauri/services/xtream-api.service.ts`, `xtream-url.service.ts` e `app/events/xtream.events.ts` compõem o fluxo. O backend monta consultas a `player_api.php`, utiliza timeout, devolve resposta/ação e trata erros HTTP. `data-sources/electron-xtream-data-source.ts` usa estratégia de consultar primeiro o banco, obter catálogo na API quando necessário e persistir o resultado. O datasource PWA e componentes legados continuam disponíveis.

**Stalker:** `home/stalker-portal-import`, `libs/services/src/lib/stalker-session.service.ts` e `app/events/stalker.events.ts` implementam requisições com MAC informado, handshake, token, perfil e criação de link de reprodução. O serviço mantém tokens em memória e coordena autenticações simultâneas. A implementação herdada inclui cabeçalhos e identificadores técnicos de compatibilidade; não se comprovou aceitação por todos os portais. Somente contas/MACs autorizados devem ser usados nas validações, sem copiar sessões da instalação de referência.

**Categorias, busca e atualização de catálogo:** as telas de categoria, busca local/global e ordenação permanecem. `events/database/category.events.ts` usa a coluna `hidden` para visibilidade. `events/database/xtream.events.ts` guarda identificadores necessários para restaurar favoritos, vistos recentemente e categorias ocultas ao atualizar o catálogo. Essa preservação no código precisa também de validação com atualização real de um catálogo autorizado.

## EPG

`libs/services/src/lib/epg.service.ts`, `app/events/epg.events.ts` e `app/workers/epg-parser.worker.ts` separam a interface da carga de XMLTV. O worker usa parsing SAX incremental com `saxes`, aceita conteúdo comprimido e grava canais/programas em lotes por sua própria conexão SQLite. O processo principal comunica progresso e processa fontes sequencialmente para reduzir disputas no banco.

O esquema contém canais, programas, índices por canal/horário e FTS5 com triggers para busca textual. Há checagem de atualização por fonte, período padrão de frescor de 12 horas, atualização forçada e limpeza. Os componentes `epg-list`, `multi-epg`, `epg-view` e painel de progresso mantêm programação e detalhes. A disponibilidade de XMLTV, correspondência de `tvg-id`, fusos e direitos de timeshift dependem da fonte; não são comprovados pela análise estática.

## Reprodução, áudio e controles

O fluxo parte de `services/player.service.ts` e `libs/ui/shared-portals/src/lib/web-player-view/web-player-view.component.ts`, passando pelos players HTML5, Video.js e ArtPlayer em `libs/ui/components`. MPV e VLC são abertos por `app/events/player.events.ts`; MPV possui comunicação IPC e acompanhamento de posição.

O proxy de `app/services/stream-proxy.service.ts` escuta em endereço de loopback com porta escolhida pelo sistema. Ele encaminha conteúdo e oferece FFmpeg para transcodificação de áudio ou completa. HLS usa Hls.js ou alternativa nativa conforme suporte; fontes TS e MP4 recebem seleção de tipo e alternativas. Os caminhos de áudio AAC/H.264 e tentativas de recuperar silêncio ou codec incompatível foram mantidos.

Volume, tela cheia, proporção, legendas nativas/WebVTT, posição inicial e emissão de progresso continuam nos players. `services/opensubtitles.service.ts` mantém integração externa condicionada à configuração do usuário. Não há evidência de equivalência completa dos seletores de idiomas de áudio entre todos os players. Hardware, codecs do Electron, conteúdo da fonte e binário FFmpeg influenciam o resultado.

As correções de ciclo de vida desta etapa e suas regressões estão em [playback-review.md](playback-review.md): reutilização do grafo Web Audio nos três players, descarte de recuperação assíncrona obsoleta e limpeza dos listeners de tela cheia HTML5. Testes unitários com mocks não equivalem a decodificação real nem comprovam áudio audível.

## Banco, cache, preferências e independência

`libs/shared/database/src/lib/app-paths.ts` centraliza o diretório padrão `%USERPROFILE%\.iptv-aurora-expert`. `AURORA_DATA_DIR` pode fornecer um caminho absoluto para testes ou outro perfil explícito. Não há importação automática do perfil iptvmate/TvMate.

| Destino próprio                                                      | Uso observado nesta etapa                                                                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `databases/aurora.db`                                                | SQLite da AURORA; o worker EPG usa o mesmo caminho fornecido pelo processo principal.                                                                                                             |
| `profile`                                                            | `userData` e `sessionData` do Electron: IndexedDB, localStorage e cache Chromium ficam no perfil próprio. O banco IndexedDB também recebe nome AURORA.                                            |
| `config/aurora-settings.json`                                        | `electron-conf`, limites da janela e preferências usadas no processo principal. Configurações do renderer continuam no armazenamento do perfil.                                                   |
| `downloads`                                                          | Destino padrão dos downloads; seleção explícita de outra pasta continua possível.                                                                                                                 |
| `logs`                                                               | Diretório Electron e registro de início da AURORA. Não implica captura completa de todo o console em arquivo.                                                                                     |
| `catalogs`, `cache/images`, `cache/metadata`, `favorites`, `history` | Diretórios próprios provisionados. Os dados lógicos existentes continuam principalmente em SQLite/IndexedDB; criar essas pastas não significa que cada módulo já grave um arquivo separado nelas. |

O esquema compartilhado preserva playlists, categorias, conteúdo, favoritos, vistos recentemente, canais/programas EPG, posições de reprodução e downloads. Favoritos/histórico não foram removidos para criar o novo diretório; continuam nas tabelas/stores existentes dentro do perfil próprio. O registro de downloads mantém status, progresso e destino; tarefas interrompidas são revistas na inicialização.

A migração `hidden` antes tentava `ALTER TABLE` em toda inicialização e ignorava qualquer erro. `libs/shared/database/src/lib/migrations.ts` agora consulta `table_info(categories)` e adiciona a coluna somente quando falta, em transação. Erros reais de esquema ou I/O não são tratados como se fossem uma migração já aplicada.

SQLite e configurações podem conter dados fornecidos pelo usuário, inclusive credenciais de playlists. Esta etapa separa os dados da instalação original; não implementa criptografia de banco ou cofre de credenciais. Também não representa uma política completa de expurgo, limite de cache ou rotação de logs.

## Inicialização, build e Windows

`bootstrap.ts` registra diagnósticos antes dos imports de aplicação, sem consumir exceções fatais. `main.ts` configura nome **IPTV AURORA EXPERT**, AppUserModelID `com.aurora.iptvexpert`, diretórios e instância única antes de prosseguir com a inicialização. `app/app.ts` constrói a janela e o preload, restaura seus limites e carrega frontend local em produção. As dependências de execução são as do próprio pacote; não há dependência do diretório instalado TvMate.

Os alvos Nx de `apps/electron-backend` ligam o build do worker aos builds de `web` e `remote-control-web`, compilam o backend e executam o empacotamento. `scripts/package-aurora.cjs` chama o electron-builder com publicação desativada, copia explicitamente o FFmpeg disponível para recursos próprios e verifica seu hash. O Node portátil indicado pelo usuário pode ser colocado no PATH apenas do processo; nenhuma alteração global é necessária.

`electron-builder.json` define appId próprio, nome do executável, ícones AURORA, artefato de setup, instalador NSIS x64, GUID independente, seleção de pasta e atalhos próprios. Arquivos legais são incluídos em `extraResources`; o módulo SQLite é desempacotado, o worker é copiado para `resources/workers` e o FFmpeg é incluído explicitamente em `resources/media`, com manifesto e hash. A opção de desinstalação mantém os dados por padrão. O resultado real de geração, assinatura, instalação e desinstalação deve ser conferido no relatório final, sem inferir sucesso apenas da configuração.

O feed de atualização está vazio em `app/constants.ts`; `update.events.ts` retorna sem configurá-lo. `electron-builder.json` usa `publish: null` e o workflow de build não cria releases nesta etapa. A consulta informativa de versão foi direcionada ao repositório oficial AURORA. Não há serviço de atualização automática AURORA implantado.

## Cobertura preservada e validações abertas

Os dez grupos funcionais solicitados permanecem na base: live; filmes/séries; favoritos/histórico; M3U/M3U8; Xtream/Stalker; EPG; players internos/externos; busca/categorias; idiomas/temas; downloads/continuidade. A evidência acima demonstra preservação de módulos e caminhos de código, não certificação de todos os fluxos com serviços externos.

Pontos materiais para uma etapa seguinte:

- Validar provedores autorizados de M3U, Xtream e Stalker, atualização sem perda de favoritos/visibilidade e retomada real de episódios.
- Validar mídia HLS, TS e MP4 com codecs e faixas distintos, legendas, tela cheia, troca rápida de fonte, reconexão e MPV/VLC no Windows.
- Revisar o comportamento TLS herdado: `main.ts` permite erros de certificados e TLS antigo; `app.ts` aceita certificados na sessão; o carregamento M3U também usa agente HTTPS sem verificação. Isso afeta a autenticação do servidor e ainda não foi substituído por exceções específicas por fonte.
- Revisar avisos e obrigações da variante FFmpeg efetivamente distribuída, além de fontes, Electron/Chromium e demais dependências, antes de distribuição pública. A licença MIT da base não substitui as licenças dos binários de mídia.
- Validar instalação/desinstalação, coexistência de processos/perfis, assinatura do executável e eventual aviso SmartScreen. Configuração NSIS própria não comprova esses resultados.
- Se a fidelidade ao TvMate continuar sendo objetivo, observar seus fluxos permitidos de interface em execução e registrar comparação por tela. Esta sessão não extraiu código proprietário nem demonstrou essa paridade.
