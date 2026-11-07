# IPTV AURORA EXPERT

Player desktop independente para Windows, baseado no código aberto do iptvmate. Suporta playlists M3U/M3U8 por arquivo, URL e texto, Xtream Codes, Stalker, EPG XMLTV, favoritos, histórico, downloads e continuidade de reprodução.

A interface conserva os fluxos da base Angular/Electron e recebe nome, símbolo e metadados AURORA. Português e tema escuro são os padrões da primeira execução; os demais idiomas e temas continuam disponíveis.

## Desenvolvimento no Windows

Requisitos: Node.js **24.15.0**, pnpm **10** e dependências do projeto. Nesta máquina, o Node portátil está em `C:\Users\Fabricio\Tools\node-v24.15.0-win-x64`.

No PowerShell, ajuste apenas a sessão atual:

```powershell
$env:PATH = 'C:\Users\Fabricio\Tools\node-v24.15.0-win-x64;' + $env:PATH
$env:NX_DAEMON = 'false'
pnpm.cmd install --frozen-lockfile
pnpm.cmd nx build electron-backend --configuration=production
```

Use `pnpm.cmd` quando a política do PowerShell bloquear `pnpm.ps1`. Nenhuma mudança permanente de PATH ou da política de execução é necessária.

Para desenvolver com recarregamento:

```powershell
pnpm.cmd nx serve electron-backend
```

Para executar o build local sem servidor Angular:

```powershell
$env:ELECTRON_IS_DEV = '0'
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
pnpm.cmd exec electron dist/apps/electron-backend/main.js
```

## Dados independentes

A raiz padrão é `%USERPROFILE%\.iptv-aurora-expert`. O aplicativo nunca importa automaticamente perfis ou dados do iptvmate ou do TvMate.

| Caminho                                                                   | Uso                                                                                                            |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `databases/aurora.db`                                                     | Catálogos SQLite, categorias, favoritos, histórico, EPG, retomada e registro de downloads                      |
| `profile/`                                                                | Perfil Chromium, IndexedDB de playlists M3U e preferências da interface, cache HTTP                            |
| `config/aurora-settings.json`                                             | Preferências nativas, janela, players e controle remoto                                                        |
| `downloads/`                                                              | Destino padrão dos arquivos baixados; a interface permite escolher outro                                       |
| `logs/startup.log`                                                        | Registro mínimo de inicialização, sem credenciais                                                              |
| `logs/main-process.log`                                                   | Diagnóstico antecipado, ambiente relevante e erros do processo principal; aplica redação de credenciais comuns |
| `catalogs/`, `cache/images/`, `cache/metadata/`, `favorites/`, `history/` | Diretórios exclusivos preparados para extensões; atualmente os registros persistem no banco/perfil acima       |

`AURORA_DATA_DIR` aceita uma raiz **absoluta** alternativa, útil para perfis de teste. O processo principal e o worker EPG usam o mesmo banco. Desenvolvimento e build local usam a mesma raiz padrão; defina uma raiz de teste para não misturar seus próprios dados.

O AppUserModelID é `com.aurora.iptvexpert`. O controle remoto permanece opcional e usa a porta padrão **8876**, configurável. O proxy de streams escolhe uma porta local disponível. A desinstalação preserva os dados do usuário.

## Verificação

```powershell
pnpm.cmd nx run electron-backend:verify-data
pnpm.cmd nx run-many -t test --parallel=2
pnpm.cmd nx run electron-backend-e2e:e2e
```

O teste de dados usa SQLite real com o ABI do Electron, em pastas de teste sob `dist`. O teste de ponta a ponta usa listas fictícias, XMLTV local e vídeos sintéticos gerados com FFmpeg; não exige provedor ou credenciais. `ELECTRON_RUN_AS_NODE` é removido do ambiente somente ao lançar a janela de teste.

Para repetir a validação de uma cópia instalada, configure `AURORA_E2E_EXECUTABLE` com o caminho absoluto de seu executável e `AURORA_E2E_PROFILE_BASE` com uma pasta de teste existente, preferencialmente fora do workspace. A suíte cria um perfil novo, usa seu diretório como diretório de trabalho e introduz caminhos inválidos de desenvolvimento em `NODE_PATH` e `FFMPEG_BIN` para verificar a independência do pacote.

## Instalador Windows

### Download pelo GitHub

Abra **Actions → Build Windows Installer**, escolha a execução concluída com sucesso na branch de desenvolvimento e, em **Artifacts**, baixe **IPTV-AURORA-EXPERT-Windows-x64**. Extraia o ZIP para acessar o instalador `.exe`, `SHA256SUMS.txt` e `build-info.json`.

O resumo da execução também mostra um link direto para o artefato. O download pelo Actions exige login no GitHub e fica disponível por 30 dias. O workflow testa o aplicativo empacotado antes de disponibilizá-lo; não cria releases nem envia alterações para a `main`. A automação desta etapa prioriza o instalador Windows x64; as configurações locais dos demais sistemas continuam no electron-builder.

### Gerar localmente

```powershell
pnpm.cmd nx run electron-backend:make
```

O alvo compila o frontend, o controle remoto, o worker EPG e o backend de produção; depois executa o electron-builder com publicação `never`. A configuração está em `electron-builder.json`; o empacotamento explícito está em `scripts/package-aurora.cjs`.

O script inclui o FFmpeg disponível em `resources/media/`, com licença, identificação e SHA-256. `scripts/verify-aurora-package.cjs` verifica o binário, o módulo SQLite, o worker, os arquivos legais e as entradas do ASAR antes de aceitar o pacote. A versão instalada carrega o FFmpeg desses recursos e não dos módulos de desenvolvimento.

Saída esperada: `dist/executables/iptv-aurora-expert-1.1.2-windows-x64-setup.exe`, além da pasta `win-unpacked`. O instalador NSIS usa identidade e GUID próprios, instalação por usuário e atalhos AURORA. Não há assinatura comercial configurada nesta etapa. A assinatura pode ser adicionada posteriormente com um certificado do responsável pelo produto.

`pnpm.cmd nx run electron-backend:package` gera somente a pasta executável. Após um build já verificado, `pnpm.cmd nx run electron-backend:make-native` executa apenas o empacotamento. Mantenha iguais as versões do `package.json` raiz e de `apps/electron-backend/package.json`.

Não há feed de atualização configurado, publicação automática de releases ou criação automática de release no workflow. O workflow de build apenas armazena artefatos de CI. O comando de empacotamento também força publicação desativada.

## Escopo e limitações

- Xtream e Stalker, busca, filmes/séries, players externos, áudio, legendas, temas e idiomas permanecem na base. A validação com cada provedor, codecs e players externos depende de conteúdo autorizado e dos programas locais correspondentes.
- A referência instalada fornecida é **TvMate IPTV Player 7.5.4 (Flutter/MSIX)**, distinta do iptvmate. Nenhum código ou arte desse produto foi copiado; paridade completa com suas telas não foi estabelecida.
- A base possui compatibilidade TLS permissiva e credenciais locais sem criptografia de aplicação. Esses comportamentos herdados estão documentados para uma etapa de endurecimento antes de distribuição pública.
- Avisos de dependências CommonJS, tamanho de bundles e Browserslist continuam registrados. Consulte os resultados efetivos de testes e empacotamento no relatório da etapa.

## Documentação

- [Arquitetura, módulos preservados e decisões](docs/architecture-and-first-stage.md)
- [Análise estática da referência](docs/reference-analysis.md)
- [Revisão e correções de reprodução](docs/playback-review.md)
- [Resultados da primeira etapa](docs/first-stage-results.md)
- [Causa e correção da exceção do processo principal](docs/main-process-incident.md)
- [Créditos e avisos de terceiros](THIRD_PARTY_NOTICES.md)

## Contribuicoes

Problemas e sugestões: https://github.com/fabriciomatosqa/IPTV-AURORA-EXPERT/issues

Faça alterações em branches de desenvolvimento. Esta etapa não publica na `main` e não cria releases.

## Licença e autoria

Licença MIT. AURORA deriva de **iptvmate**, de Thomas McIntee e colaboradores, e da base histórica **IPTVnator**, de 4gray e colaboradores. Os avisos originais em [LICENSE.md](LICENSE.md) permanecem intactos. Consulte [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) para atribuições e dependências.
