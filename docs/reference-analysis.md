# Análise estática dos aplicativos de referência

Data: 6 de novembro de 2026. Escopo: somente os dois diretórios de referência indicados pelo usuário, sem execução, instalação, alteração ou extração de código do aplicativo. Não foram consultados perfis de usuário, credenciais ou listas pessoais.

## Identidade encontrada

Há uma diferença importante entre a descrição inicial e os artefatos fornecidos: o aplicativo instalado é **TvMate IPTV Player 7.5.4.0**, publicado por **Velocity Apps Team**, com pacote `2242VelocityAppsTeam.TiviMate_7.5.4.0_x64__v313ts49xh8we`. Ele não é a base Electron/Angular iptvmate deste repositório.

Observações diretas de `AppxManifest.xml`:

- Identidade: `2242VelocityAppsTeam.TiviMate`, versão `7.5.4.0`, arquitetura `x64`.
- Executável: `IPTV.exe`; application ID: `cleaniptv`; entrada: `Windows.FullTrustApplication`.
- Nome exibido: `TvMate IPTV Player`; descrição: `IPTV Expert`.
- Windows Desktop mínimo declarado: `10.0.17763.0`.
- Idioma de recurso declarado: `en-us`; capacidade: `runFullTrust`.
- A identidade do editor, nomes dos blocos e caminhos das imagens estão declarados no manifesto. Não foram reaproveitados no produto AURORA.

O recurso de versão do executável, lido pela API de arquivos do Windows, declara `cleaniptv`, versão `7.5.4+205`, empresa `iptv.expert.player` e copyright de 2023 com todos os direitos reservados. A licença MIT do código-fonte iptvmate não deve ser atribuída a esse outro produto.

## Inventário e evidências

O diretório instalado contém 203 arquivos, totalizando 116.820.313 bytes. O inventário de arquivos não encontrou `.asar`, `.db`, `.sqlite` ou `.sqlite3` nesse diretório; isso não demonstra ausência de bancos no perfil do aplicativo, que não foi acessado.

O instalador é um MSIX de 50.297.288 bytes. O inventário REA examinou as 205 entradas de arquivos do contêiner, sem contradições de integridade reportadas. Essa checagem não equivale à validação da assinatura digital Microsoft Store.

| Artefato                                     | SHA-256                                                            |
| -------------------------------------------- | ------------------------------------------------------------------ |
| MSIX `TvMate IPTV Player 7.5.4.0 (x64).Msix` | `fb0d9e4e7c64f353477b1d1db660788020c00e13798e831a4a002ac1454781a6` |
| Instalado `IPTV.exe`                         | `a3dc36e337b3a9251830775ee47cfbc8b6c6da64fe61a243f81fecec6c589ddd` |
| Instalado `AppxManifest.xml`                 | `537b9db7ea7341d947a0d9dec3e347a8cc5a639e1ea27482bfc1998ac00cfe0e` |
| Instalado `data/flutter_assets/NOTICES.Z`    | `5f604717754c4ebb4d38176a4ef34c21ce1f66eb6b69507618201d9a43ac2acd` |

Os hashes do executável, manifesto e avisos instalados coincidem com os mesmos três membros do MSIX, calculados em memória sem gravar seus conteúdos.

Referências REA da sessão:

- Recursos PE: `ev_1d383d6fb0f677265fabb774a729b706192f4d3caf1ef442f2093ca5aa10d232`. PE32+, máquina `0x8664`, quatro recursos (ícone, grupo de ícones, versão e manifesto), 12 entradas examinadas. Um grupo referencia o ícone com tamanho consistente. A ferramenta não decodificou a imagem nem observou sua apresentação no Windows.
- Inspeção do MSIX: `ev_03aed645c45bca272892592037fcc209f1188b473befb74021a54a14127bb7d1`; inventário subjacente `ev_a4aa656a8481885dfc38f4af73fbd231ccfe9ec85ac98731fa3beab7ad30f253`.
- Visão resumida: `ev_2b74e53797380519163e2f62fca7ddd922e41fac5dc97b2036f66599d42a106a`; seleção de oito membros relevantes: `ev_5c20e338753c00c0f37a9cd716672c6784cca305b03083bf1ae282a429f5bd39`.

Esses identificadores referem-se às evidências da sessão REA; a tabela acima preserva a identidade dos arquivos independentemente da sessão.

## Arquitetura: observações e inferências

**Observado:** o pacote contém `flutter_windows.dll`, `data/app.so`, `data/flutter_assets`, plugins Flutter de janela, brilho e vídeo, `media_kit_video_plugin.dll`, `fvp_plugin.dll`, `libmpv-2.dll`, `mdk.dll`, `ffmpeg-7.dll`, `libass.dll` e `isar.dll`. O manifesto de fontes lista `MaterialIcons-Regular.otf`. O manifesto de assets lista ícones de proporção/preenchimento, ordenação, animações de reprodução, perfis, atualização e paywall, além de imagens próprias do aplicativo.

**Inferência limitada:** a distribuição corresponde a uma aplicação Flutter com componentes nativos de reprodução e uma biblioteca Isar. A presença desses componentes não prova qual player é selecionado em cada fluxo, quais codecs estão habilitados, quais tabelas são usadas ou se cada recurso da interface está ativo.

`NOTICES.Z` é um arquivo gzip de avisos de terceiros. A leitura em memória encontrou referências a Flutter, Dart, media_kit, Isar e textos de permissão MIT. Esses avisos documentam componentes de terceiros; não concedem licença ao código e às artes próprias do produto. Nenhum arquivo, imagem, animação, binário, fonte ou código do pacote foi incorporado à AURORA.

## Comparação com a base aberta

A base deste repositório usa Angular, Electron, TypeScript e Nx, conforme `package.json`; possui serviços IPC no backend e componentes web no frontend. Isso difere da distribuição Flutter/MSIX encontrada.

As rotas de `apps/web/src/app/app.routes.ts` estabelecem início/importação, playlists/player, configurações, Xtream e Stalker. O backend de `apps/electron-backend/src/main.ts` registra eventos de playlists, banco, player, EPG, Xtream, Stalker, controle remoto e downloads. O esquema compartilhado exporta playlists, categorias, conteúdo, favoritos, vistos recentemente, EPG, posições de reprodução e downloads. Essas são evidências do código aberto que pode ser preservado e personalizado, não uma prova de paridade com TvMate.

## Cobertura e pontos não estabelecidos

| Pergunta                                                                 | Resultado desta análise estática                                                 |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Identidade, versão, formato e metadados Windows                          | Respondida pelo manifesto, recursos PE e inventário                              |
| Componentes de interface, reprodução e persistência distribuídos         | Parcial: componentes inventariados; fluxo real não observado                     |
| Licença do código e artes próprios do aplicativo instalado               | Não estabelecida; copyright do executável reserva direitos                       |
| Telas, menus, submenus, cores, tipografia aplicada, posições e navegação | Não observados em execução; nomes de assets não demonstram layout                |
| Importação/atualização M3U, Xtream, Stalker e EPG do instalado           | Não estabelecidas sem inspeção de execução autorizada ou documentação licenciada |
| Favoritos, histórico, cache, preferências e banco do instalado           | Não inspecionados; nenhum perfil pessoal acessado                                |
| Codecs, áudio, legendas, controles e recuperação de erros do instalado   | Não testados; bibliotecas presentes não provam suporte efetivo                   |
| Instalação, desinstalação e atualização do MSIX                          | Somente declarações estáticas; instalador não executado                          |
| Paridade funcional e visual AURORA/TvMate                                | Ainda não demonstrada                                                            |

Consequência para a implementação: manter os módulos e a estrutura visual da base aberta como ponto de partida, criar identidade e recursos próprios e validar seu funcionamento separadamente. Não apresentar a análise estática dos metadados como análise completa do comportamento do aplicativo instalado.
