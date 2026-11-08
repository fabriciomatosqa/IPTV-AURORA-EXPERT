# Atualizações e carregamento de catálogos

Nas configurações, **Verificar atualização** consulta a última release pública. Uma versão nova oferece **Baixar atualização** e, depois da verificação SHA-512, **Reiniciar e instalar**. O app também consulta ao iniciar, após 30 segundos, e a cada quatro horas; o download e a instalação dependem do clique do usuário. Fechar o programa não instala automaticamente.

O feed oficial é `https://github.com/fabriciomatosqa/IPTV-AURORA-EXPERT/releases/latest/download/latest.yml`. Cada release precisa conter o instalador referenciado nesse manifesto. Commits na main sem uma release publicada não são atualizações instaláveis. A instalação anterior 1.1.2 não possuía esse atualizador: precisa receber a primeira nova versão pelo EXE.

## Publicar as próximas versões

Execute o workflow **Build Windows Installer** na main com `publish_release` habilitado. Ele calcula a próxima sequência usando as tags remotas, testa, empacota, testa o executável e publica o EXE, latest.yml, blockmap e os hashes. A execução padrão em push/PR apenas valida e disponibiliza o artefato.

Para preparar localmente: `node scripts/prepare-release.cjs`. A data usa America/Sao_Paulo. `--date=2026-11-07 --sequence=2` permite uma escolha explícita para manutenção; não reutilize versões já publicadas. Depois execute `pnpm nx run electron-backend:make`.

O nome público é `0.0.DDMMAA-NN`. Esse nome contém zeros à esquerda e não pode ser usado diretamente como SemVer. O pacote usa internamente `AAAA.MMDD.N`, por exemplo `2026.1107.1`, preservando a ordem também na troca do mês e do ano. O manifesto utiliza a versão interna em `version` e a pública em `releaseName`. As tags usam `v0.0.DDMMAA-NN`.

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
