# IPTV AURORA EXPERT — resultado da primeira etapa

Data: **6 de novembro de 2026**. Versão: **1.1.2**. Branch: `feat/aurora-first-functional-version`.

Foi entregue uma primeira versão Windows funcional, com identidade e dados próprios. O instalador foi gerado, instalado fora do repositório, exercitado com dados fictícios e desinstalado. A exceção do processo principal relatada durante a sessão foi reproduzida, diagnosticada e corrigida antes dessa validação final.

## Análise realizada

- Arquitetura Angular/Electron/TypeScript/Nx, rotas, menus, importação, armazenamento, EPG, reprodução, downloads e empacotamento. Evidências e limites estão em [architecture-and-first-stage.md](architecture-and-first-stage.md).
- Manifestos, inventário MSIX, metadados Windows, recursos PE e avisos dos diretórios de referência, somente para consulta. A referência é **TvMate IPTV Player 7.5.4, Flutter/MSIX**, diferente do código aberto iptvmate. Não foi presumida licença MIT para esse produto, nem copiado seu código ou suas artes. Consulte [reference-analysis.md](reference-analysis.md).
- Ciclo de vida de áudio, recuperação assíncrona e tela cheia dos players. Consulte [playback-review.md](playback-review.md).

Os diretórios de referência e os dados pessoais do aplicativo original não foram modificados ou importados. Nenhum outro projeto AURORA foi utilizado como fonte de implementação.

## Implementação e identidade

| Área                  | Resultado                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Produto               | Nome oficial **IPTV AURORA EXPERT**, janela, menus, cabeçalhos, boas-vindas e traduções atualizados                                                   |
| Identificadores       | Pacote `iptv-aurora-expert`, AppUserModelID/appId `com.aurora.iptvexpert`, GUID NSIS próprio                                                          |
| Arte                  | Símbolo geométrico AURORA original em SVG; PNG, ICO e ICNS gerados localmente                                                                         |
| Preferências iniciais | Português e tema escuro, preservando os demais idiomas, temas e preferências já gravadas                                                              |
| Dados                 | Raiz `%USERPROFILE%\.iptv-aurora-expert`; SQLite `databases/aurora.db`; perfil Chromium, configurações, downloads e logs próprios                     |
| Worker EPG            | Mesmo banco do processo principal; executável JavaScript em `resources/workers`; resolução de módulos nativos do próprio pacote                       |
| Downloads             | Destino padrão exclusivo do AURORA; escolha manual de outro destino preservada                                                                        |
| Controle remoto       | Continua opcional; porta padrão 8876; conflito de porta não derruba o aplicativo                                                                      |
| Links e atualizações  | Repositório/suporte AURORA; feed automático vazio; publicação `never`; workflow sem criação automática de release                                     |
| Licenças              | `LICENSE.md` original intacto; créditos iptvmate/IPTVnator preservados; avisos incluídos no instalador; FFmpeg com licença, fornecedor, versão e hash |

Favoritos, histórico, catálogos e retomada persistem no SQLite ou no perfil conforme o módulo original. As pastas exclusivas adicionais para imagens, metadados, catálogos, favoritos e histórico foram preparadas; não foi criado um segundo armazenamento concorrente desses registros. Os detalhes estão no README e no relatório de arquitetura.

Aliases técnicos de compatibilidade, como `@iptvmate/pipes`, foram mantidos para não quebrar imports. Não são identificadores de instalação ou de perfil.

## Problemas corrigidos

1. **Exceção `undefined: undefined` no pacote Windows.** O import de `@ffmpeg-installer/ffmpeg` lançava uma string porque o binário opcional não havia sido incluído. O FFmpeg disponível agora é copiado explicitamente para `resources/media`, e o aplicativo instalado resolve esse recurso sem consultar o ambiente de desenvolvimento. A verificação do pacote exige o arquivo e seu SHA-256. [Diagnóstico completo](main-process-incident.md).
2. **Recursos incompletos/inconsistentes.** Corrigidos inclusão do `package.json` no ASAR, mapeamento e resolução do worker EPG, normalização dos caminhos Windows na inspeção do ASAR e duplicação de `extraResources` ao carregar a configuração do builder.
3. **Migração `hidden`.** A coluna é consultada antes do `ALTER TABLE`; inicialização repetida não produz erro de coluna duplicada. Erros reais de schema continuam sendo propagados. A inicialização pode ser repetida após uma falha e usa WAL/busy timeout para acesso concorrente com o worker.
4. **Áudio após troca de canal.** HTML5, Video.js e ArtPlayer reutilizam o grafo Web Audio. Recuperações assíncronas antigas não substituem uma seleção mais recente. Os listeners de tela cheia do HTML5 são removidos ao destruir o componente.
5. **Diagnóstico antecipado.** O bootstrap registra ambiente relevante, logs e exceções antes dos imports da aplicação, sem consumir o tratamento fatal padrão. Uma falha ao escrever o diagnóstico não transforma uma mensagem de console em uma nova falha de aplicação. Há redação de credenciais em formatos comuns.
6. **Ambiente de testes.** `ELECTRON_RUN_AS_NODE=1`, herdado pelo executor, é removido dos filhos que precisam abrir interface. Continua sendo usado explicitamente no teste de SQLite com ABI Electron. Nenhum PATH ou ajuste global do Windows foi alterado.
7. **Testes antigos.** Specs comentados ou baseados em APIs removidas foram atualizados para contratos atuais. Corrigida a resolução de exports de testes Angular 21 e a transformação UUID ESM no Jest.

## Módulos preservados e cobertura de execução

| Módulo                                         | Evidência desta sessão                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| M3U/M3U8                                       | Importação por texto pela interface; leitura de URL pelo IPC; menus para arquivo/URL/texto preservados    |
| Ao vivo e player                               | MP4 H.264/AAC e HLS com segmentos MPEG-TS sintéticos reproduzidos no player interno                       |
| Transcodificação                               | FFmpeg do pacote executou transcodificação de áudio pelo proxy; saída MP4 fragmentada conferida           |
| EPG                                            | XMLTV local importado pelo worker real; programa consultado, frescor verificado e dados limpos por worker |
| Filmes/séries e busca                          | Módulos mantidos; catálogo fictício consultado por IPC e busca local validada                             |
| Favoritos, histórico e retomada                | Gravação/leitura de dados fictícios no banco instalado, incluindo posição de reprodução                   |
| Downloads                                      | Vídeo sintético baixado, status concluído e arquivo no destino exclusivo verificados                      |
| Xtream/Stalker                                 | Implementações e entradas de navegação preservadas; autenticação com provedores reais não foi exercitada  |
| Players externos, legendas e áudio alternativo | Código e configurações preservados; validação com instalações/fontes reais permanece pendente             |
| Temas e idiomas                                | Compilados e mantidos; configurações/persistência cobertas pelos testes atuais                            |

A reprodução foi testada com o áudio silenciado no harness para não emitir som durante a automação. Isso comprova o fluxo de mídia e a execução da transcodificação, mas não uma avaliação auditiva ou compatibilidade universal de codecs.

## Resultados das verificações

| Verificação                                              | Resultado                                                                                                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend de produção, controle remoto e backend Electron | **Aprovados** por alvos Nx                                                                                                                            |
| Suíte unitária completa                                  | **11 projetos**, **25 suítes**, **69 testes aprovados**; **4 `todo` preexistentes**                                                                   |
| SQLite real, ABI Electron                                | **6 grupos de verificações aprovados**: diretórios, falha/retry e concorrência, schema novo, migração antiga, erros reais e rejeição de raiz relativa |
| Lint do backend final                                    | **Aprovado**, sem erros ou avisos de ESLint                                                                                                           |
| Lint global consultado                                   | **Ainda não aprovado**: existem erros em serviços/componentes/web e avisos de tipagem/templates; não foi feita uma reescrita ampla desses módulos     |
| Verificação do pacote                                    | **Aprovada**: entrada, preload, frontend, controle remoto, SQLite nativo, worker, arquivos legais e FFmpeg com hash correspondente                    |
| Instalação NSIS                                          | **Código 0**, instalação temporária fora do workspace                                                                                                 |
| E2E da cópia instalada                                   | **10 testes aprovados**, em 10,2 s; aplicativo, perfil e diretório de trabalho fora do projeto; `NODE_PATH` e `FFMPEG_BIN` inválidos de propósito     |
| Abertura interativa normal                               | **Aprovada**: tela inicial AURORA observada, sem flags de desenvolvimento/teste; banco criado; sem exceção fatal no log                               |
| Desinstalação da cópia temporária                        | **Código 0**, executável removido e perfil/banco de teste preservados                                                                                 |

Comandos usados incluem `pnpm.cmd nx build electron-backend --configuration=production`, `pnpm.cmd nx run-many -t test --parallel=2`, `pnpm.cmd nx run electron-backend:verify-data`, `pnpm.cmd nx lint electron-backend` e os alvos `make`/`make-native`. A suíte Electron foi executada por Nx contra o caminho da instalação temporária.

Persistem avisos de tamanho de bundles/estilos, dependências CommonJS, Browserslist e avisos de ambiente/depreciação das ferramentas. Não foram tratados como sucesso do lint global. Os projetos sem specs são identificados como tal nos logs, sem contabilização artificial de testes.

## Instalador entregue

Arquivo local: `dist/executables/iptv-aurora-expert-1.1.2-windows-x64-setup.exe`.

- Tamanho: **144.603.178 bytes**.
- SHA-256: `8B650373C6783CBD909D2616312F6FBFC6FDCACD8FC4DC480175CDAF461773EA`.
- Assinatura Authenticode: **NotSigned**. Nenhum certificado comercial foi configurado.
- Pacote portátil para inspeção: `dist/executables/win-unpacked/IPTV AURORA EXPERT.exe`.
- A cópia temporária usada nos testes de instalação foi desinstalada. O setup e a pasta `win-unpacked` permanecem disponíveis.

Não houve publicação na `main`, criação de tag/release ou envio dos binários como release. O instalador defeituoso anterior está separado, com nome `rejected-before-ffmpeg-fix-setup.exe`, na pasta local de diagnósticos.

## Logs e arquivos principais

Os logs locais são ignorados pelo Git e estão em `dist/aurora-diagnostics/`, incluindo os registros do processo principal antes/depois da correção, stderr/stdout, execução normal, testes instalados e manifestos de instalação/desinstalação/artefato. Os logs de build, testes unitários, SQLite e lint também permanecem em `dist/aurora-*.log`. Use dados autorizados ao repetir esses testes; logs podem conter informações operacionais de fontes configuradas.

Arquivos centrais modificados:

- `apps/electron-backend/src/bootstrap.ts`, `src/main.ts` e `src/app/app.ts` — entrada antecipada, diagnóstico, identidade e perfil.
- `libs/shared/database/src/lib/app-paths.ts`, `connection.ts` e `migrations.ts` — dados independentes e migração.
- `apps/electron-backend/src/app/services/ffmpeg-paths.ts` e `stream-proxy.service.ts` — resolução do recurso de mídia.
- `apps/electron-backend/src/app/events/epg.events.ts` e `workers/epg-parser.worker.ts` — recurso do worker e banco compartilhado.
- `electron-builder.json`, `scripts/package-aurora.cjs` e `scripts/verify-aurora-package.cjs` — instalador e verificação obrigatória.
- `libs/ui/components/src/lib/{html-video-player,vjs-player,art-player}/` — correções de reprodução.
- `apps/web/src/assets/aurora/`, traduções, cabeçalho, diálogo Sobre, manifesto e `index.html` — identidade visual.
- `apps/electron-backend-e2e/src/smoke.e2e.ts`, specs atualizados e `scripts/verify-aurora-data.cjs` — regressões.

## Pendências

1. Validar provedores Xtream/Stalker autorizados, contas, atualização de catálogos e listas grandes em condições reais.
2. Completar a matriz de codecs/áudio/legendas, HEVC, AC-3/E-AC-3, players externos, reconexão e testes prolongados. MPEG-TS bruto fora do HLS não foi validado nesta sessão.
3. Corrigir a dívida de lint dos demais módulos e os quatro testes `todo`; validar separadamente o E2E da versão web/PWA.
4. Planejar endurecimento da compatibilidade TLS permissiva e proteção das credenciais em repouso, comportamentos herdados documentados na arquitetura.
5. Preparar assinatura digital e revisar as obrigações/licenças das variantes binárias de mídia antes de uma distribuição pública. Não há publicação automática configurada.
6. Se a paridade com o TvMate continuar como requisito, fazer uma comparação permitida de suas telas/comportamentos. A análise estática desta sessão não estabelece equivalência visual completa.
