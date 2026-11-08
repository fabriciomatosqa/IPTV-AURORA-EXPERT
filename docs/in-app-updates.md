# Atualizações e carregamento de catálogos

## Formato de versões e canais

O nome exibido ao usuário segue **FASE.ETAPA.DDMMAA-NN**, com duas etapas
antes da data e com sequência independente para cada fase e dia:

| Uso | Exemplo | Publicação GitHub |
| --- | --- | --- |
| Desenvolvimento | `0.0.081126-01` | Pré-lançamento (quando publicado) |
| Testes beta, para outras pessoas | `0.1.081126-01` | Pré-lançamento |
| Versão definitiva | `1.0.081126-01` | Versão estável/latest |

Na mesma data, o sufixo `-01` pode ser usado nas três fases: trata-se de
sequências independentes. `-02` significa a segunda compilação publicada
**naquela fase e naquela data**.

O Windows e o `electron-updater` usam internamente uma versão numérica
SemVer diferente, pois `081126` com zeros à esquerda não serve para
comparação de versões: `AAAA.MMDD.(etapa + sequência)`. A etapa de
desenvolvimento ocupa `10001–19999`, beta `20001–29999` e estável
`30001–39999`. Exemplos para 08/11/2026:

- `0.0.081126-01` → `2026.1108.10001`
- `0.1.081126-01` → `2026.1108.20001`
- `1.0.081126-01` → `2026.1108.30001`

Esses números garantem a ordem desenvolvimento → beta → definitiva,
também respeitando os limites numéricos do Windows.

O atualizador consulta a lista pública de Releases do GitHub e seleciona
uma versão maior **do canal permitido**. Desenvolvimento pode receber
desenvolvimento, beta e definitiva; beta pode receber outra beta ou
definitiva; uma instalação definitiva **nunca** recebe beta automaticamente.
A versão escolhida é baixada a partir do `latest.yml` publicado junto
ao **tag exato**, permitindo encontrar betas marcadas como pré-lançamento
sem colocá-las como última versão estável.

No aplicativo, **Verificar atualização** consulta as releases publicadas.
Uma versão nova oferece **Baixar atualização** e depois
**Reiniciar e instalar**, com verificação de integridade. O download
e a instalação só ocorrem após ação do usuário.

**Compatibilidade com instaladores antigos:** a versão já distribuída
`0.0.081126-01` tem numeração interna legada `2026.1108.1` e usa
apenas `/releases/latest`. Ela não pode aprender a descobrir
pré-lançamentos sem primeiro instalar uma versão com o novo atualizador.
A primeira migração poderá exigir instalar manualmente o novo EXE; após
isso, as transições de beta para definitiva e futuras versões são feitas
pelo programa. As listas e preferências são preservadas.

## Publicar as próximas versões


Execute **GitHub Actions → Build Windows Installer → Run workflow** na
branch `main`; marque `publish_release` e escolha `release_stage`:

- `development` gera `0.0.DDMMAA-NN` e marca a release como prerelease.
- `beta` gera `0.1.DDMMAA-NN` e marca a release como prerelease.
- `stable` gera `1.0.DDMMAA-NN` e define a nova release definitiva/latest.

O workflow escolhe automaticamente a próxima sequência procurando tags
**somente da fase escolhida e do dia atual**. Ele executa testes, empacota,
verifica o executável e só então publica EXE, `latest.yml`, blockmap e
hashes. Publicações comuns na `main`, sem `publish_release`, geram apenas
o artefato do Actions: não são atualizações instaláveis.

Para testar localmente o gerador:
`node scripts/prepare-release.cjs --date=2026-11-08 --stage=beta --sequence=1`.
Use `--stage=stable` para versão definitiva. Essas mudanças locais alteram
metadados e nome do instalador; não publique uma tag já existente.

## Catálogos

Links get.php com contas Xtream ativas usam a API para recuperar filmes, séries e temporadas que podem não existir no download M3U. Na abertura de uma lista antiga, a detecção preserva o M3U salvo e seus favoritos, adiciona os dados de acesso à API e encaminha ao catálogo. A indisponibilidade da API mantém o M3U local. Favoritos de canais M3U não são convertidos automaticamente em favoritos de entidades Xtream.

M3U comum usa caminho do stream, marcadores de episódio, grupos informados pelo usuário e extensão da mídia para classificação. Grupos ambíguos e entradas sem metadados suficientes continuam dependendo dos dados do provedor. Os nomes de grupo não são alterados. A identificação de uma categoria por nome não cria sinopse, elenco ou temporadas ausentes.

O parser roda em worker no Electron. O renderer cria um índice único em lotes de mil itens, cede tempo à interface e reutiliza esse índice entre abas e temporadas. O estado de playlists mantém apenas metadados e o histórico do Store Devtools fica desabilitado na produção. A grade começa com até 200 itens.

A logo original fica em `apps/web/src/assets/aurora/aurora-official.png`, idêntica ao `logo.png` fornecido. `node scripts/generate-aurora-icons.cjs` gera os tamanhos PNG e os contêineres ICO/ICNS sem redesenhar a marca.

O patch versionado de @nx/js preserva letras de unidade nos caminhos usados pelo compilador TypeScript no Windows. Ele corrige a falha TS6059 causada pelo uso de joinPathFragments em caminhos físicos e é aplicado pelo pnpm na instalação.

## Validação da primeira release

Em 07/11/2026: 120 testes unitários aprovados nos projetos alterados; quatro casos antigos permanecem TODO. A suíte do executável Windows instalado aprovou 18 testes, incluindo categorias fornecidas, lista grande, indicador de carregamento, API get.php, migração de M3U antigo, configurações e download verificado do instalador pelo atualizador real. Uma lista sintética de 20.100 itens levou 2.187 ms do envio até a primeira grade neste computador, incluindo 300 ms de atraso artificial de rede; esse número não é garantia para outros provedores.

O cenário do atualizador usa feed HTTP restrito a 127.0.0.1 e NODE_ENV de teste, anuncia uma versão futura de QA e baixa o instalador real até o estado pronto. Essa versão fictícia não é instalada. O acionamento quitAndInstall e o bloqueio de instalação antes do download têm testes unitários; a instalação limpa do NSIS real foi executada separadamente, com retorno 0. O teste não certifica a atualização completa entre duas releases públicas diferentes. O provedor privado do usuário não foi acessado.

Evidências locais: `dist/aurora-update-final-unit.log`, `dist/aurora-update-categories-unit.log`, `dist/aurora-update-backend-final.log`, `dist/aurora-update-installed-e2e.log`, `dist/aurora-update-package.log` e `dist/test-results/electron-backend-e2e/aurora-update-ready.png`.
