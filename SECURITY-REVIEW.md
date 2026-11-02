# Revisao de seguranca do frontend e backend

Data: 2026-11-02

## Backend utilizado

O frontend `techlist-admin-frontend` consome a API `techlist-api`. Em
desenvolvimento, o Vite encaminha `/api`, `/auth`, `/funcao`, `/health` e
`/usuario` para `http://localhost:3001`. Em producao, a configuracao Nginx
fornecida encaminha essas rotas para `127.0.0.1:3001`.

O frontend pode usar `VITE_API_BASE_URL` como base URL; sem essa variavel,
faz chamadas relativas a mesma origem.

## Achado

| Severidade | Arquivo | Linhas | Vulnerabilidade | Confianca |
|---|---|---:|---|---:|
| HIGH | `deploy/nginx/admin.oncad.com.br.conf` | 2-3, 13-24 | A configuracao versionada escuta em HTTP e nao mostra redirecionamento para HTTPS. Se utilizada sem uma configuracao HTTPS complementar, credenciais, tokens e respostas da API podem trafegar sem criptografia. | 8/10 |
| HIGH | `../techlist-api/ecosystem.config.js` | 16, 25, 29, 34 | O arquivo versionado contem atribuicoes literais para configuracoes sensiveis, incluindo credenciais de banco, JWT e integracoes. Se os valores forem validos, qualquer pessoa com acesso ao repositorio pode usa-los. | 9/10 |
| HIGH | `../techlist-api/app/config/auth.config.js` | 4 | A API usa um segredo JWT fixo como fallback quando `JWT_SECRET` nao esta definido; nesse caso, tokens podem ser forjados por quem conheca o valor embutido. | 9/10 |

### Recomendacao

Configure HTTPS no Nginx e redirecione todas as requisicoes HTTP para HTTPS
antes de disponibilizar as rotas de autenticacao e API. A revisao foi estatica:
nao foi verificada a configuracao ativa do servidor, do DNS ou do certificado,
portanto este achado descreve o arquivo do projeto e nao confirma o estado do
deploy remoto.

Remova valores sensiveis do codigo e injete-os em runtime a partir de um
gerenciador de segredos ou do ambiente protegido do servidor. Trate credenciais
potencialmente validas ja versionadas como expostas e faca a rotacao delas;
defina `JWT_SECRET` obrigatoriamente e remova o fallback fixo.
