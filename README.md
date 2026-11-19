# COPOLLGA — Liga de PES 2011 ⚽🏆

Projeto do aplicativo COPOLLGA 6.0 (beta), para gestão dos campeonatos da liga.

## O que o aplicativo oferece

- Seleção dos clubes presentes, sorteio de **dois grupos** e confrontos internos em turno único.
- Campeonatos com **4 a 10 participantes**.
- Com 6–10 clubes: os líderes vão diretamente às semifinais e os 2º colocados enfrentam os 3º colocados do grupo oposto nos playoffs.
- Semifinais, final, disputa de 3º lugar e **Copa-Louça** (perdedor lava a louça).
- Ranking geral: **5 pontos ao campeão, 3 ao vice e 2 ao terceiro**.
- Cadastro de clubes e elencos, artilharia e mercado de transferências.
- Acesso por e-mail com perfis de administrador, técnico e participante, após configurar o Supabase.

## Como publicar no GitHub Pages

1. Baixe o pacote **COPOLLGA 6.0 — Site para publicar** fornecido no projeto ChatGPT.
2. Extraia o ZIP em seu computador.
3. Entre neste repositório e selecione **Add file > Upload files**.
4. Envie **o conteúdo da pasta do site**, não o ZIP: `index.html`, `app.js`, `style.css`, `config.js`, `manifest.webmanifest` e a pasta `assets/`.
5. Confirme **Commit changes**. Os arquivos devem ficar na raiz do repositório.
6. Em **Settings > Pages**, selecione **Deploy from a branch**, branch `main` e diretório `/(root)`. Salve.
7. Quando o GitHub Pages concluir a publicação, o endereço previsto será: https://thallestech15-cell.github.io/copollga/

> **Atenção:** o link acima só funcionará depois de enviar os arquivos e ativar o Pages. O site precisa do Supabase configurado para login e sincronização dos dados.

## Configuração do Supabase

No pacote completo da COPOLLGA 6.0 há dois arquivos SQL em `sql/`:

1. Execute `01_estrutura_e_seguranca.sql` no **SQL Editor** do seu projeto Supabase.
2. Execute `02_clubes_e_elencos_historicos.sql` para adicionar os dez clubes e os 288 registros históricos de jogadores.
3. No arquivo `config.js`, preencha **apenas** a URL e a chave pública `anon` ou `publishable`. Envie a versão configurada para este repositório.
4. No Supabase, em **Authentication > URL Configuration**, cadastre o endereço final do GitHub Pages como Site URL e URL de redirecionamento.
5. Cadastre seu usuário e atribua o papel de administrador conforme o **GUIA_INSTALACAO.md** do pacote completo.

**Nunca publique:** senha do banco, chave `service_role`, chave `sb_secret_` ou outras credenciais privadas. A chave pública do frontend não substitui as regras de acesso (RLS).

## Situação

- Repositório preparado para receber os arquivos do aplicativo.
- Publicação do GitHub Pages e conexão com Supabase: **pendentes**.
- O projeto é **beta**: autenticação, operações multiusuário e segurança devem ser testadas com o Supabase real antes de colocar a liga em produção.

O emblema original escolhido para a COPOLLGA será usado sem alteração.
