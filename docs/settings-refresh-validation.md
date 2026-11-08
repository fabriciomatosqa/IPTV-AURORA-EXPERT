# Configurações — 0.0.081126-01

A tela passa a organizar as preferências por Geral, Reprodução, Guia de TV, Legendas, Controle remoto e Listas e dados. O painel de atualizações mantém a versão instalada e as ações de verificar, baixar e instalar. O rodapé mostra alterações pendentes e mantém Salvar acessível. A seleção de seção preserva os campos editados; salvar continua usando o armazenamento de preferências existente.

Foram mantidos os reprodutores externos, formato de stream, fontes de EPG, legendas, conexão remota com QR code, importação, exportação e manutenção das listas. Novos textos têm tradução em português e inglês; os campos sem tradução em português foram corrigidos. O layout se adapta aos temas claro e escuro, à página completa e ao diálogo aberto pelo catálogo.

## Verificações locais

- 42 testes do projeto web e 25 do backend aprovados.
- 19 testes no executável instalado e atualizado aprovados, incluindo carregamento de catálogo e o download do atualizador.
- Um teste adicional focado nas configurações aprovou gravação entre seções, validação da porta, persistência após recarregar e o diálogo aberto pelo menu do catálogo.
- Capturas conferidas em 1366×768, 1920×1080, 980×720 e 620×800; sem rolagem horizontal do documento nem corte do botão Salvar. A navegação estreita tem rolagem própria.

## Atualização real entre versões

Uma instalação separada da release 0.0.071126-01 recebeu o instalador real da 0.0.081126-01 por um feed local de QA, usando o atualizador da versão antiga. A busca e o download foram acionados na interface; a instalação usou o mesmo IPC do botão Reiniciar e instalar, sem alterar os argumentos do instalador. O assistente NSIS do Windows foi concluído pelo controle de interface.

O app foi reaberto com o mesmo perfil de teste e confirmou a versão 0.0.081126-01. Foram preservados uma lista M3U com um canal, um filme e favorito em SQLite e a preferência de idioma de legendas `pt`. Não foram usados dados nem credenciais de um provedor privado.

Evidências: `dist/settings-real-update-state.json`, `dist/settings-real-update-verification.log`, `dist/settings-real-update-before.png`, `dist/settings-real-update-after.png`, `dist/settings-installed-e2e.log`, `dist/settings-dialog-e2e.log`, `dist/settings-unit-final.log`, `dist/settings-unit.log` e `dist/settings-package.log`.

Capturas da tela ficam em `dist/test-results/electron-backend-e2e/aurora-settings-*`.
