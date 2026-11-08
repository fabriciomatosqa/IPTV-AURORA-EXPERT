# Resultado da reconstrução AURORA

7 de novembro de 2026. Branch local: `feat/aurora-reference-playlist-rebuild`, criada da `main` atualizada em `f3e2f96`. Nenhuma publicação na main, push ou release foi realizada.

## Entrega e referência

A reconstrução usa as seis capturas fornecidas pelo usuário: TV, menu, filmes, séries e os respectivos detalhes. A observação direta pelo controle do Windows alcançou somente o player do pacote TvMate instalado. O produto do link da Store e esse pacote têm identidades/editor diferentes. Por isso, não se afirma ter observado o produto exato da Store em execução. A evidência e a avaliação da arquitetura estão em [reference-runtime-and-rebuild.md](reference-runtime-and-rebuild.md).

| Marco                           | Situação real                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Referência                  | **Parcial.** Seis telas documentadas a partir das capturas; player do pacote fornecido observado em execução. Inicialização, cadastro, EPG e configurações do produto exato ainda não observados.                                                                                                                                                                                                          |
| 2 — Reprodução                  | **Validado com fontes locais autorizadas.** M3U Plus por URL, arquivo M3U8, texto e cadastro Xtream exercitados pela interface; MP4, HLS e MPEG-TS decodificados. A playlist real do usuário não estava disponível e continua pendente de teste local pelo usuário.                                                                                                                                        |
| 3 — Interface principal         | **Parcial.** Catálogo M3U reconstruído; categorias, busca, linhas de canais e grades de pôsteres testados. Navegação e grades Xtream reformuladas. Boas-vindas/cadastro mantêm a estrutura funcional anterior; a TV ao vivo Xtream ainda usa o painel herdado.                                                                                                                                             |
| 4 — Filmes, séries e adicionais | **Parcial.** Detalhes de filme e série reconstruídos a partir das novas imagens; temporadas em faixas horizontais; detalhes M3U e agrupamento por marcação SxxExx; favoritos, histórico, downloads e reprodução testados dentro do escopo abaixo. Página completa de perfil/menu, casting, fotografias de elenco, trailers externos e paridade integral de configurações não foram validados/reproduzidos. |
| 5 — Validação e instalador      | **Concluído para esta entrega de desenvolvimento.** Compilação, NSIS, instalação em diretório isolado e 14 testes no executável instalado aprovados. Instalador sem assinatura digital; não é uma release publicada.                                                                                                                                                                                       |

## Correções funcionais

- Validação compartilhada de M3U/M3U Plus para URL, arquivo, texto e atualização; BOM/espaços iniciais são normalizados. Categorias, logotipos, URLs e metadados disponíveis são preservados.
- Categorias de erro distintas para autenticação/HTTP, DNS, timeout, conexão, leitura de arquivo, conteúdo inválido e catálogo vazio. A mensagem não reflete o corpo retornado pelo provedor, caminhos privados ou URLs de conta.
- Endereços relativos de reprodução são resolvidos contra a URL final após redirecionamento.
- Arquivo inválido mantém a importação aberta; cancelamento não é tratado como erro; arrastar arquivo no desktop e MIME ausente por extensão são aceitos. A playlist inteira deixou de ser impressa no console.
- A importação de texto inválido não encerra permanentemente o efeito NgRx. A atualização manual também apresenta falhas de forma segura.
- Rotas desktop preservam `index.html` e o hash; recarregar a playlist deixa de causar `ERR_FILE_NOT_FOUND`. Assets continuam no pacote.
- Busca/ordenação/paginação Xtream funcionam também na seleção Todas.
- A área do player passa a respeitar o espaço de seus controles após a inclusão do retorno ao catálogo.

Um manifesto HLS de segmentos é identificado como vídeo, não importado indevidamente como uma lista de canais. Para HLS, o fluxo validado é uma playlist M3U/M3U8 cujos itens apontem ao manifesto. Arquivos M3U com caminhos de mídia relativos sem URL de origem recebem diagnóstico; reprodução de mídia local referenciada por esses caminhos não foi implementada.

## Testes finais

| Verificação                                                        | Resultado/evidência                                                                                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitários: web, components, services, m3u-utils e electron-backend | **95 aprovados**, em 27 suítes; **4 casos antigos todo** em components. Nenhuma falha na rodada final. `dist/aurora-regression-final.log`.                                                              |
| Electron a partir do código compilado                              | **14 aprovados**, 24,7 s. `dist/aurora-functional-details.log`.                                                                                                                                         |
| Executável instalado, fora do workspace                            | **14 aprovados**, 25,0 s. `dist/aurora-installed-functional.log`. Sem reutilizar cache da tarefa.                                                                                                       |
| Instalador NSIS                                                    | Compilação aprovada; instalação silenciosa retornou **0**. Recursos ASAR, preload, frontend, worker EPG, módulo SQLite, FFmpeg/SHA-256 e licenças verificados pelo hook de empacotamento.               |
| Resoluções                                                         | Área útil de **1366×768** e **1920×1080**: canais, filmes, séries e detalhes M3U; detalhes de filme Xtream capturados nas duas. Não houve rolagem horizontal indevida do documento nas grades testadas. |

Fluxos exercitados pela interface: configurações e retorno; cinco tipos de importação preservados; texto M3U; URL inválida, HTTP 401, HTML inválido e catálogo vazio; recuperação após erro; importação por URL; arquivo real lido pelo backend com seleção nativa controlada; categorias, busca, favorito, histórico e recarga; filmes/séries M3U e temporadas com SxxExx; cadastro Xtream, busca em Todas, categorias, detalhes de filme, elenco disponível, download e reprodução, temporadas, rolagem horizontal, episódio e retorno ao catálogo.

No teste de arquivo, o seletor nativo foi substituído pelo retorno determinístico de um caminho temporário, mas o clique de importação, a leitura física, a validação, o armazenamento e o resultado visual são reais. Não é um teste de interação manual com o diálogo do Windows.

EPG: XMLTV sintético processado pelo worker real, consulta do programa, atualização e limpeza aprovadas pelo IPC. O desenho visual do guia não foi comparado com a referência. Persistência SQLite de favoritos, histórico, categorias e retomada também foi exercitada por IPC; o histórico/favorito M3U tem cobertura adicional pela interface.

Mídia efetivamente decodificada: **MP4 H.264/AAC**, **HLS com segmentos MPEG-TS H.264/AAC**, **MPEG-TS direto H.264/AAC**. Também houve transcodificação de áudio para MP4 fragmentado pelo FFmpeg. O teste MPEG-TS valida a estratégia recebida da main, sem atribuir essas correções anteriores integralmente a esta branch. Pausa/retomada e tela cheia acionadas pelos botões Video.js no MP4 passaram; troca de canais passou. A saída foi silenciada: áudio audível, idiomas alternativos, HEVC, AC-3/E-AC-3, legendas, recuperação de rede e a playlist privada não estão certificados por esses testes.

Nas rodadas intermediárias foram corrigidos o erro real de recarga, a tipagem do foco de temporada e os testes que usavam URLs sintéticas iguais para canais distintos ou um seletor ambíguo durante animação da notificação. A primeira tentativa de empacotamento coincidiu com outra compilação e perdeu um arquivo de saída; o empacotamento final foi repetido em sequência e aprovado.

## Capturas reais do AURORA instalado

As imagens mais recentes são do executável instalado, com catálogo e artes sintéticos. As seis imagens comerciais recebidas no chat permanecem como referência visual e não foram copiadas para o aplicativo.

| Tela                     | Captura                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| TV 1366                  | [aurora-live-1366.png](../dist/test-results/electron-backend-e2e/aurora-live-1366.png)                                 |
| TV 1920                  | [aurora-live-1920.png](../dist/test-results/electron-backend-e2e/aurora-live-1920.png)                                 |
| Filmes                   | [aurora-movies-1920.png](../dist/test-results/electron-backend-e2e/aurora-movies-1920.png)                             |
| Séries                   | [aurora-series-1920.png](../dist/test-results/electron-backend-e2e/aurora-series-1920.png)                             |
| Filme M3U                | [aurora-m3u-movie-details-1920.png](../dist/test-results/electron-backend-e2e/aurora-m3u-movie-details-1920.png)       |
| Temporadas M3U           | [aurora-m3u-series-details-1920.png](../dist/test-results/electron-backend-e2e/aurora-m3u-series-details-1920.png)     |
| Filme Xtream             | [aurora-xtream-movie-details-1920.png](../dist/test-results/electron-backend-e2e/aurora-xtream-movie-details-1920.png) |
| Série e episódios Xtream | [aurora-xtream-episodes.png](../dist/test-results/electron-backend-e2e/aurora-xtream-episodes.png)                     |
| Reprodução MPEG-TS       | [aurora-playing-mpegts.png](../dist/test-results/electron-backend-e2e/aurora-playing-mpegts.png)                       |
| Tela cheia               | [aurora-fullscreen.png](../dist/test-results/electron-backend-e2e/aurora-fullscreen.png)                               |

Comparação: navegação estreita, categorias/busca no topo, canais compactos, pôsteres, detalhes com pôster à direita e temporadas horizontais seguem a organização visível das referências. AURORA usa sua própria marca, tema escuro e acentos verdes. O menu é funcional em dropdown; não reproduz a página de perfil. Os controles de reprodução e a TV Xtream ainda têm elementos da base anterior. M3U sem sinopse/elenco/nota continua sem esses campos. Favoritar uma série agrupada M3U marca o item representativo; não é um modelo completo de favoritos por entidade de série.

## Instalador e commits

- Arquivo: `dist/executables/iptv-aurora-expert-1.1.2-windows-x64-setup.exe`, **144.588.238 bytes**.
- SHA-256: `d4735b21f575c9bd1a7bfe9530ceaf7783e11cd2a949de40f8505dc97a08a278`.
- Assinatura Authenticode: `NotSigned`.
- Instalação de revisão: `C:\Users\Fabricio\AppData\Local\Programs\AuroraExpert-Review-20261107`.
- Perfis de teste separados: `%LOCALAPPDATA%\AuroraExpert-Reconstruction-Tests`. O aplicativo instalado foi iniciado com pasta de trabalho fora do workspace e caminhos de FFmpeg/NODE_PATH de desenvolvimento propositalmente inexistentes, para conferir seus recursos próprios.
- Versão mantida em **1.1.2** para esta build local; nenhuma release automática.
- `f8dd086`: importação e mensagens seguras.
- `4de1e3c`: rotas/recarregamento do desktop.
- `fb29061`: catálogos, navegação, detalhes e temporadas.
- Os testes ampliados e este relatório estão no commit de validação posterior, consultável por `git log` da branch.

O projeto Angular/Electron permanece viável e foi preservado. Esta entrega é uma reconstrução funcional substancial, com limites registrados, e não uma declaração de reprodução completa do aplicativo comercial.
