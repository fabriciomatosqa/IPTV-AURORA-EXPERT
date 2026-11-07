# Exceção no processo principal do pacote Windows

Data: 6 de novembro de 2026. Identificação: primeira etapa AURORA, versão 1.1.2.

## Falha reproduzida e causa confirmada

A janela **“A JavaScript error occurred in the main process — Uncaught Exception: undefined: undefined”** ocorreu ao iniciar `dist/executables/win-unpacked/IPTV AURORA EXPERT.exe`, durante a validação do aplicativo empacotado. A interface não chegou a abrir. O frontend/backend executados diretamente em `dist/apps` passavam nos testes, pois conseguiam resolver as dependências no `node_modules` do workspace.

O registro antecipado em `bootstrap.ts` revelou a exceção original: **`Could not find ffmpeg executable, tried ...`**, lançada como **string** pelo módulo `@ffmpeg-installer/ffmpeg`. Esse valor não tem `name`, `message` ou `stack`, explicando os dois `undefined` mostrados pelo tratamento padrão do Electron.

`stream-proxy.service.ts` importava esse módulo no carregamento do processo principal. O empacotamento incluía o módulo JavaScript, mas não seu pacote opcional de plataforma `@ffmpeg-installer/win32-x64` com o executável. O binário pós-instalação do `ffmpeg-static` também não estava disponível nesta instalação de dependências. A regra `asarUnpack` sozinha não inclui arquivos ausentes da coleta de dependências.

O erro não era uma falha de schema SQLite ou do worker EPG. Ele acontecia antes de sua inicialização. A verificação separada do SQLite real já passava; os caminhos e recursos nativos continuam sendo verificados no pacote e nos testes de execução.

## Correção

- O empacotamento escolhe o FFmpeg realmente disponível, executa `-version` e o copia explicitamente para `resources/media/ffmpeg.exe`, fora do ASAR. Inclui identificação do fornecedor, licença GPLv3 e manifesto com versão, configuração e SHA-256. Nesta máquina o fornecedor disponível é `@ffmpeg-installer/ffmpeg`, revisão `f22fcd4483`.
- A versão empacotada resolve somente esse recurso próprio. Não importa os instaladores de desenvolvimento e não usa `FFMPEG_BIN`, `NODE_PATH`, diretório atual ou instalação original como fallback. Um recurso obrigatório ausente produz um `Error` descritivo.
- O hook após empacotar verifica o SHA-256 do FFmpeg, o módulo nativo SQLite, o worker EPG, as licenças, os metadados e os arquivos de entrada, preload, frontend e controle remoto no ASAR.
- O electron-builder recebe o arquivo de configuração uma única vez. A combinação anterior de descoberta automática do JSON com o mesmo objeto de configuração duplicava `extraResources`, causando uma falha adicional `EBUSY` na cópia concorrente do executável de mídia.
- `bootstrap.ts` registra o ambiente relevante, os logs do processo principal e exceções antes dos imports de aplicação. Usa `uncaughtExceptionMonitor`, preservando o tratamento fatal padrão do Electron; não oculta nem consome o erro.
- Os handlers de importação e limpeza do EPG usam `resources/workers/epg-parser.worker.js`, com mapeamento explícito no builder e o mesmo banco do processo principal. A conclusão de um trabalho é distinguida do encerramento inesperado: o código 1 produzido por `terminate()` após conclusão não é mais relatado como falha de processamento.
- A verificação do ASAR normaliza os separadores de caminho para Windows. Assim, confere também arquivos em pastas aninhadas, como o controle remoto.

## Ambiente de teste

O processo hospedeiro desta sessão herda `ELECTRON_RUN_AS_NODE=1`. Essa variável é intencional no verificador de SQLite que usa o ABI nativo do Electron, mas é removida somente do ambiente filho quando se lança a interface. Uma tentativa inicial com a variável herdada falhou com `bad option: --remote-debugging-port=0`; é uma falha distinta da exceção FFmpeg confirmada acima.

Os testes de interface usam uma raiz `AURORA_DATA_DIR` nova e absoluta. O aplicativo empacotado é iniciado com diretório atual fora do workspace. O bootstrap registra os valores reais por acesso dinâmico ao ambiente, evitando que o DefinePlugin substitua `NODE_ENV` por um valor do build no diagnóstico.

## Evidências e resultado

Os logs completos locais estão em `dist/aurora-diagnostics/main-process-before-fix.log` e `dist/aurora-diagnostics/packaged-before-fix-e2e.log`. O instalador anterior foi separado nessa pasta com o nome `rejected-before-ffmpeg-fix-setup.exe`; não deve ser utilizado. Esses artefatos não são versionados no Git.

Os testes de regressão verificam que o pacote não importa provedores de desenvolvimento, ignora `FFMPEG_BIN` ao resolver mídia e relata corretamente um recurso ausente. A suíte de ponta a ponta exercita também a transcodificação real de áudio pelo proxy, além de interface, banco, worker, playlists, reprodução e downloads. Consulte `first-stage-results.md` para os resultados finais efetivamente obtidos após recompilar; este documento não presume sucesso apenas a partir da correção de código.

**Resultado final:** instalador recompilado e instalado em pasta temporária fora do workspace, com código 0. Os **10 testes de ponta a ponta passaram nessa instalação**, com perfil e diretório de trabalho também fora do projeto. A abertura interativa normal, sem `ELECTRON_IS_DEV`, `ELECTRON_RUN_AS_NODE`, `NODE_ENV`, `NODE_OPTIONS`, `NODE_PATH` ou `FFMPEG_BIN`, exibiu a interface AURORA e criou o banco. A desinstalação terminou com código 0 e preservou o perfil de teste.

Os registros após a correção estão em `dist/aurora-diagnostics/main-process-after-fix.log`, `electron-after-fix.log`, `normal-main-process.log` e `packaged-after-fix-e2e.log`. Não foram encontrados os marcadores `uncaught:` ou `loading-main-failed` nos logs finais. Os testes também conferem a ausência dessas exceções. O instalador anterior separado para diagnóstico não é o instalador entregue.
