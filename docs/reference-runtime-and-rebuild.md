# Reconstrução AURORA — referência e validação

Data local: 7 de novembro de 2026. Base: `origin/main` em `f3e2f96`. Branch: `feat/aurora-reference-playlist-rebuild`. Os diretórios IPTV MATE INSTALADO e IPTV MATE INSTALADOR foram somente lidos. Nenhum recurso, código, biblioteca, fonte ou imagem comercial foi incorporado ao AURORA.

## Identidade: o link e os artefatos são produtos diferentes

Consulta ao catálogo público da Microsoft:

`https://storeedgefd.dsx.mp.microsoft.com/v9.0/products/9P6HJ5ZSWFB8?market=BR&locale=pt-BR&deviceFamily=Windows.Desktop`

| Fonte                                              | Nome/editor                                     | Identidade                                             |
| -------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Produto `9P6HJ5ZSWFB8` da Store                    | IPTV Expert Premium Player / LIFTOFF            | `30317JulienVermet.IPTVPlayerPlus_fm5hvxqdz8pr8`       |
| Manifesto fornecido e registro Windows instalado   | TvMate IPTV Player 7.5.4.0 / Velocity Apps Team | `2242VelocityAppsTeam.TiviMate_v313ts49xh8we`          |
| Janela encontrada pelo controle gráfico do Windows | Título da janela: IPTV Expert                   | Pertence ao segundo pacote, application ID `cleaniptv` |

O título da janela não comprova equivalência. O pacote do produto indicado na Store não foi encontrado no inventário de aplicativos Windows desta sessão. A página HTML da Store falhou na ferramenta de navegação; a API pública acima respondeu e forneceu nome, editor e família do pacote. A análise estática anterior em `reference-analysis.md` continua válida dentro de seu escopo, mas não estabelece identidade com o link.

## O que foi realmente observado

1. **Execução direta:** janela do pacote TvMate com vídeo em reprodução e áreas pretas acima/abaixo; não havia árvore de acessibilidade útil. Escape não revelou navegação. Não foram observados diretamente os demais fluxos nem o arranque limpo. Não se afirma que esse programa seja o produto do link.
2. **Seis capturas enviadas pelo usuário nesta execução:** TV ao vivo, menu, grade de séries, grade de filmes, detalhes de filme e detalhes de série. Elas são a evidência visual usada na reconstrução. Não foi necessário extrair assets ou decompilar o aplicativo comercial.

| Tela das capturas | Organização observada                                                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TV                | Barra estreita à esquerda; ícones com rótulos para TV, séries, filmes, downloads e menu; categorias no alto à esquerda; busca arredondada à direita; faixa de ferramentas A–Z/favoritos/recentes; cinco colunas de canais com logo, nome, estrela e opções. |
| Filmes e séries   | Mesma estrutura; aproximadamente onze colunas de pôsteres nas capturas largas; imagens na proporção aproximada de 2:3; título abaixo; nota quando presente; estrela e opções sobre o pôster.                                                                |
| Menu              | Navegação lateral mantida; coluna de perfil e uma lista central simples: playlists, reprodução, EPG e tema, além das opções comerciais do aplicativo. Dados pessoais da imagem não foram transcritos para o projeto.                                        |

Nas imagens reduzidas a 2048 px de largura, a navegação ocupa aproximadamente 100 px e a faixa de ferramentas 75 px; nomes de canais aparecem em texto de cerca de 13–14 px e títulos de seção em cerca de 26 px. Essas medidas são estimativas da imagem, não leitura dos controles internos. As capturas não estabelecem hover, atalhos, tamanhos mínimos, comportamento da ordenação ou conteúdo de submenus. Os botões e fluxos do AURORA usam implementação própria.

As duas imagens posteriores mostram filme com informações à esquerda, pôster grande à direita, ações na base e elenco abaixo; a série usa cabeçalho menor e episódios horizontais por temporada, com pôster pequeno à direita. Não foram recebidas/observadas telas de boas-vindas, cadastro, player com controles abertos, EPG ou configurações do produto exato. Essas telas não são declaradas reproduzidas.

## Implementação

- M3U: catálogo ocupa a janela, com barra lateral de 84 px, categorias e busca no topo, canais em linhas compactas e filmes/séries em pôsteres. Favoritos, histórico, ordenação, opções de reprodução e retorno do player estão disponíveis. A renderização é incremental, em lotes de 200; a busca consulta o catálogo completo.
- A separação M3U usa caminhos explícitos `/movie/` e `/series/` ou grupos declarados como Filmes/Movies/VOD e Séries/Series. O grupo original e os demais metadados permanecem no catálogo. Não se inventam sinopses, notas, temporadas ou identificação de episódios que não vieram do provedor.
- Detalhes: a composição anterior foi substituída por informações à esquerda e pôster à direita. Filmes têm ações e elenco quando fornecido; séries têm cabeçalho compacto e todas as temporadas em faixas horizontais, com reprodução, progresso, marcação de assistido e downloads preservados. O trailer é exibido sob demanda quando informado pelo provedor. O elenco usa nomes/identificadores visuais próprios, sem buscar fotografias de terceiros.
- M3U: filmes abrem detalhes antes de reproduzir. Séries com marcação explícita `S01E01` são agrupadas por título e grupo original, com episódios ordenados em temporadas. Nomes sem essa marcação continuam disponíveis como itens independentes; não há inferência por catálogo externo. O player retorna aos detalhes de onde foi aberto.
- Xtream: filmes/séries ganham seletor de categoria no cabeçalho e grade mais ampla, removendo o painel permanente de categorias. A busca e paginação agora também filtram a seleção Todas. A barra de navegação concentra os recursos adicionais em Menu.
- O player existente, worker EPG, banco SQLite, downloads, posições, favoritos e mecanismos de empacotamento foram preservados. O player e a TV Xtream ainda têm elementos herdados; não se afirma paridade visual integral.
- Menu M3U: acesso às listas, configurações de reprodução e EPG. A página de perfil/menu da referência não foi integralmente reproduzida.

## Importação e diagnóstico

Um validador compartilhado atende URL, arquivo, texto e atualização. Ele normaliza BOM/espaço inicial, exige cabeçalho M3U, preserva M3U Plus e rejeita conteúdo inválido e catálogo vazio. Endereços relativos são resolvidos contra a URL final após redirecionamento. Falhas de DNS, conexão, timeout, HTTP/autenticação, arquivo, formato e catálogo vazio têm mensagens distintas, sem refletir conteúdo do provedor ou endereços privados.

O diálogo de arquivo permanece aberto após erro/cancelamento. Arquivos M3U/M3U8/TXT com MIME ausente são aceitos pela extensão, e arrastar arquivo no desktop deixa de ser ignorado. O console não recebe a playlist inteira. Texto inválido não fecha a importação nem interrompe permanentemente o efeito NgRx.

Um manifesto HLS de segmentos não é um catálogo de canais: ele é identificado como tal e recebe orientação. É possível importar um catálogo M3U/M3U8 cujos canais apontem para HLS. A importação direta de um manifesto HLS como playlist de um canal não foi implementada.

O roteamento Electron usa hash com base vazia, mantendo `index.html` no endereço ao navegar e recarregar. A mudança é específica do desktop; a configuração das URLs web foi preservada.

## Avaliação da arquitetura

Angular/Electron é viável: a nova organização não exigiu trocar o framework nem a persistência; o proxy FFmpeg permite decodificar MPEG-TS em Chromium. A refatoração concentra o catálogo no frontend e a validação em biblioteca compartilhada. Uma migração total acrescentaria custo de reimplementar IPC, SQLite, EPG, downloads e instalador sem resolver a conectividade do provedor por si só.

Limites atuais: transcodificação completa consome CPU e depende de FFmpeg; codecs e múltiplas faixas precisam de uma matriz de testes mais ampla. M3U continua no IndexedDB isolado do perfil Electron; Xtream e demais recursos usam o SQLite existente. Unificar essa persistência exige migração controlada. Episódios M3U sem identificação explícita de temporada/episódio não são agrupados automaticamente. Não há evidência para abandonar a base atual.

## Limites dos testes

As fontes são geradas localmente pelo FFmpeg: vídeo H.264 e áudio AAC em MP4, HLS com segmentos TS e MPEG-TS direto. A progressão de tempo, readyState e ausência de erro do elemento de vídeo verificam decodificação; os testes silenciam a saída. Pausa, retomada e entrada/saída de tela cheia foram acionadas pelos controles Video.js no caso MP4. Isso não comprova áudio audível, HEVC, AC-3/E-AC-3, todos os controles dos demais players ou o provedor particular. Nenhuma credencial real estava disponível ou foi procurada em perfis pessoais.

As imagens próprias dos testes são SVGs sintéticos. Os screenshots do AURORA são capturas da janela Electron real e ficam em `dist/test-results/electron-backend-e2e/`: `aurora-live-1366.png`, `aurora-live-1920.png`, `aurora-movies-1366.png`, `aurora-movies-1920.png`, `aurora-series-1366.png`, `aurora-series-1920.png`, além das capturas de reprodução. Não são maquetes. Resultados finais, instalador e situação dos marcos estão em `reconstruction-results.md`.
