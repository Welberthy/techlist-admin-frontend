# Techlist Admin Frontend

Aplicacao administrativa em React, TypeScript e Vite.

## Desenvolvimento local

Requer Node.js 22 e npm.

```sh
npm ci
npm run dev
```

Durante o desenvolvimento, o Vite encaminha as chamadas de API para `http://localhost:3001`. Inicie a API nesse endereco antes de testar login e funcionalidades que dependem do backend.

## Validacao

```sh
npm run lint
npm run build
```

O workflow do GitHub Actions executa lint e build nos pull requests para `main`. Ao integrar na `main`, publica o conteudo de `dist/` no servidor por SSH.

## Deploy e servidor

O frontend e o `techlist-api` estao em repositorios GitHub diferentes. O workflow do frontend publica no mesmo servidor, mas em um diretorio separado da API:

- API: `/home/<DEPLOY_USER>/techlist-api`
- Frontend: `/var/www/admin.oncad.com.br/releases/` com link ativo em `/var/www/admin.oncad.com.br/current`

Configure no proprio repositorio `techlist-admin-frontend` o ambiente GitHub `deploy_oncad` (`Settings > Environments`). Secrets de um repositorio nao ficam automaticamente disponiveis em outro; cadastre nesse ambiente os mesmos valores de conexao SSH usados pelo deploy do backend:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_KEY`
- `DEPLOY_PORT` (opcional; padrao `22`)
- `DEPLOY_KNOWN_HOSTS` (chave(s) publica(s) do host SSH, no formato `known_hosts`)

`DEPLOY_KNOWN_HOSTS` deve ser obtido e validado por um canal confiavel. Compare a impressao digital da chave exibida pelo servidor (`sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`) com a chave publica antes de cadastra-la. Nao confie cegamente no resultado de `ssh-keyscan`.

O usuario de deploy no servidor precisa poder executar `sudo` sem senha para `install`, `mv` e `ln`. O Nginx deve estar instalado e o DNS de `admin.oncad.com.br` apontado para o servidor antes do primeiro deploy. O workflow nao configura Nginx, DNS, TLS nem instala a API.

### Configuracao inicial do Nginx

No servidor, instale o Nginx e o Certbot, copie `deploy/nginx/admin.oncad.com.br.conf` para `/etc/nginx/sites-available/admin.oncad.com.br`, habilite o site e valide a configuracao:

```sh
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx/admin.oncad.com.br.conf /etc/nginx/sites-available/admin.oncad.com.br.conf
sudo ln -s /etc/nginx/sites-available/admin.oncad.com.br.conf /etc/nginx/sites-enabled/admin.oncad.com.br.conf
sudo nginx -t
sudo systemctl reload nginx
```

Depois que o DNS estiver propagado e as portas 80 e 443 estiverem liberadas no firewall, emita o certificado HTTPS:

```sh
sudo certbot --nginx -d admin.oncad.com.br
```

O Nginx serve o frontend em `/var/www/admin.oncad.com.br/current` e encaminha `/api/`, `/auth`, `/funcao`, `/usuario` e `/health` para a API local em `127.0.0.1:3001`. O frontend usa caminhos relativos por padrao, permitindo que navegador e API usem a mesma origem HTTPS sem tentar acessar o `localhost` do computador do usuario.

Pull requests executam apenas validacao. Push para `main` (ou execucao manual na branch `main`) valida e publica o frontend; o deploy nao altera o processo PM2 nem os arquivos da API.
