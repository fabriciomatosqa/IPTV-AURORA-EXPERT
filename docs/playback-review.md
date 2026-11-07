# Revisão de reprodução — primeira etapa AURORA

Análise do código-fonte em 6 de novembro de 2026. Esta revisão não executou o aplicativo TvMate de referência nem utilizou playlists privadas.

## Fluxo preservado

| Área                           | Evidência no código                                                                                                          | Comportamento preservado / limite                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Seleção de player              | `apps/web/src/app/services/player.service.ts`, `libs/ui/shared-portals/src/lib/web-player-view/web-player-view.component.ts` | HTML5, Video.js, ArtPlayer e integração MPV/VLC. A navegação seleciona fontes e aplica alternativas para live/VOD.                                                       |
| HLS                            | `html-video-player.component.ts`, `art-player.component.ts`                                                                  | Hls.js com início após leitura do manifesto, recuperação de erro de mídia e alternativa nativa. Não comprova disponibilidade de um servidor real.                        |
| MPEG-TS                        | `web-player-view.component.ts`, `vjs-player.component.ts`                                                                    | Identificação MIME `video/mp2t`, alternativa `.m3u8` para live Xtream e proxy local. Compatibilidade final depende dos codecs presentes.                                 |
| MP4 / MKV / outros contêineres | HTML5, Video.js e `apps/electron-backend/src/app/services/stream-proxy.service.ts`                                           | MP4 direto quando aplicável; FFmpeg com transcodificação de áudio para AAC e alternativa completa H.264/AAC. Fluxo resultante é MP4 fragmentado.                         |
| Áudio                          | Players e proxy FFmpeg                                                                                                       | Volume, detecção de silêncio, tentativa de transcodificação e seleção técnica por `aidx`. Não há evidência de um seletor universal de idiomas de áudio na interface.     |
| Legendas                       | HTML5, Video.js e ArtPlayer                                                                                                  | Faixas nativas e WebVTT externo; configuração de legendas e serviço de busca existentes. Autenticação do serviço externo e sincronia real precisam de validação própria. |
| Tela cheia / proporção         | HTML5, ArtPlayer e plugin Video.js                                                                                           | HTML5 prioriza o elemento hospedeiro com alternativa Electron; ArtPlayer oferece proporção e tela cheia; Video.js mantém seu plugin de proporção.                        |
| Continuidade                   | `startTime`, `timeUpdate`, serviço de posição e eventos MPV                                                                  | Reposição de tempo e emissão de progresso preservadas; não foi feita validação com episódios de um provedor.                                                             |

## Correções aplicadas

1. HTML5, Video.js e ArtPlayer agora reutilizam a conexão Web Audio durante a troca de fonte ou tentativa de transcodificação. O código anterior mantinha a primeira conexão ativa e tentava criar outra `MediaElementAudioSourceNode` para o mesmo vídeo; navegadores rejeitam essa segunda associação. O contexto suspenso também recebe tentativa de retomada.
2. Uma resposta assíncrona da recuperação de áudio não pode substituir um canal escolhido mais recentemente. HTML5 usa uma geração por seleção/destruição; Video.js confere a fonte atual e o estado de destruição.
3. HTML5 remove os listeners de tela cheia do `document` quando o componente é destruído.

As estratégias existentes de codecs, fallback, proxy e players externos foram mantidas. Não foi reescrito nenhum módulo de reprodução.

## Verificação

- Baseline do teste HTML5: quatro falhas antes de alcançar as asserções porque jsdom não implementa os eventos de `TextTrackList`. O spec agora fornece os limites de mídia simulados necessários.
- O `tsconfig.spec.json` de `components` usava `moduleResolution: node10`, incapaz de resolver corretamente os exports de testes do Angular 21 instalado. Atualizado para `bundler` e módulo ES2022 com interoperabilidade de módulos.
- O antigo spec de item EPG declarava um componente standalone e usava um modelo XML antigo com cast. Atualizado para importar o componente e verificar uma programação fictícia no modelo atual, incluindo o indicador ao vivo e a abertura dos detalhes.
- Regressões específicas: reutilização da conexão de áudio em três players, liberação da conexão, descarte de recuperação após trocar canal/destruir o componente e remoção dos listeners de tela cheia.
- `pnpm.cmd nx test components --runInBand`: **9 suítes aprovadas, 15 testes aprovados e 4 casos antigos marcados como todo**, em 25,9 s. Saída em `dist/components-test-aurora.log` (arquivo local ignorado pelo Git). Aviso de ambiente `NO_COLOR`/`FORCE_COLOR`, sem falhas.

## Validação ainda necessária

Na validação final da etapa, a instalação Windows fora do workspace passou em 10 testes de ponta a ponta, incluindo MP4 H.264/AAC, HLS com segmentos TS e transcodificação de áudio pelo FFmpeg incluído no pacote. A importação/limpeza do EPG pelo worker e os downloads também passaram. Os resultados e logs estão descritos em `first-stage-results.md` e `main-process-incident.md`.

Os testes unitários usam mídia simulada; não decodificam HLS/TS/MP4 nem comprovam áudio audível. Testar em Windows com fontes autorizadas: H.264/AAC, HEVC, AC-3/E-AC-3, áudio alternativo, WebVTT, retomada de episódio, mudança rápida de canal, desconexão/reconexão e MPV/VLC instalados. Validar também as faixas em todos os players: o código atual não demonstra equivalência completa dos seletores entre eles.
