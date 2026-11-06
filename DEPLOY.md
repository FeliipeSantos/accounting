# Deploy em VPS

Guia para publicar o Project Accounting (Portal de Projetos + Inteligência Contábil) numa VPS Linux (Ubuntu 24.04 ou Debian 12) com Nginx e HTTPS.

**Arquitetura:** internet → Nginx (HTTPS, porta 443) → Node em `127.0.0.1:8080` (systemd) → dados em `/var/lib/project-accounting/`.

> Escolha uma **VPS no Brasil**: alguns sites oficiais podem recusar acessos de fora do país ou de datacenters. O passo 7 confirma isso.

---

## 1. Preparar o servidor

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git ufw
# Node.js 22 LTS ou superior (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # precisa ser >= 22.9
```

Firewall: só SSH, HTTP e HTTPS.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Usuário dedicado (sem login) e pastas:

```bash
sudo useradd --system --home /opt/project-accounting --shell /usr/sbin/nologin project-accounting
sudo mkdir -p /opt/project-accounting /var/lib/project-accounting
sudo chown project-accounting:project-accounting /var/lib/project-accounting
sudo chmod 750 /var/lib/project-accounting
```

## 2. Instalar o código

```bash
sudo git clone https://github.com/FeliipeSantos/accounting.git /opt/project-accounting
cd /opt/project-accounting
sudo chown -R root:project-accounting /opt/project-accounting
```

O projeto não tem dependências npm: não é preciso `npm install`.

O repositório traz só o necessário para rodar. Os testes automáticos ficam na máquina de desenvolvimento: rode `npm test` lá **antes** de enviar cada atualização ao GitHub.

## 3. Levar os dados atuais

Copie do seu computador os dois arquivos de dados para a VPS (ajuste usuário/host):

```bash
scp db.json intelligence-db.json usuario@ip-da-vps:/tmp/
```

Na VPS:

```bash
sudo mv /tmp/db.json /tmp/intelligence-db.json /var/lib/project-accounting/
sudo chown project-accounting:project-accounting /var/lib/project-accounting/*.json
sudo chmod 640 /var/lib/project-accounting/*.json
```

## 4. Configurar o `.env`

```bash
cd /opt/project-accounting
sudo cp .env.example .env
```

Gere o hash da senha de cada usuário (a senha é digitada no terminal, mínimo 10 caracteres):

```bash
npm run auth:hash -- seu.usuario
```

Cole a linha `AUTH_USERS=...` gerada no `.env` (vários usuários separados por vírgula). Confira também `HOST=127.0.0.1`, `TZ=America/Sao_Paulo`, `TRUST_PROXY=true` e os caminhos `DB_FILE` / `INTEL_DB_FILE`.

Proteja o arquivo (contém os hashes das senhas):

```bash
sudo chown root:project-accounting .env
sudo chmod 640 .env
```

## 5. Serviço (systemd)

```bash
sudo cp deploy/project-accounting.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now project-accounting
sudo systemctl status project-accounting
```

O log deve mostrar algo como:

```
Servidor rodando em http://localhost:8080 (escutando em 127.0.0.1)
[intelligence] agendamento ativo: diariamente às 06:00; próxima execução ...
```

Se aparecer aviso de **fuso horário** ou **"Nenhum usuário configurado"**, revise o `.env`. Para acompanhar o log:

```bash
sudo journalctl -u project-accounting -f
```

Teste local na VPS:

```bash
curl -s http://127.0.0.1:8080/healthz
```

## 6. Nginx + HTTPS

1. Aponte o DNS do domínio (registro A) para o IP da VPS.
2. Crie o snippet de proxy e a zona de limite de login, conforme comentários no fim de `deploy/nginx.conf`.
3. Copie o site (troque `seu-dominio.com.br` no arquivo) e, **antes do certificado**, comente o bloco `server { listen 443 ... }`:

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/project-accounting
sudo ln -s /etc/nginx/sites-available/project-accounting /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo mkdir -p /var/www/certbot
sudo nginx -t && sudo systemctl reload nginx
```

4. Gere o certificado gratuito (Let's Encrypt) e reative o bloco 443:

```bash
sudo apt install -y certbot
sudo certbot certonly --webroot -w /var/www/certbot -d seu-dominio.com.br
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

A renovação é automática (timer do certbot). Teste com `sudo certbot renew --dry-run`.

5. Acesse `https://seu-dominio.com.br` e entre com o usuário criado no passo 4.

> O cookie de sessão é `Secure` em produção: **o login só funciona por HTTPS**. Pelo IP em HTTP a tela de login aparece, mas a sessão não se mantém.

## 7. Confirmar as fontes oficiais a partir da VPS

```bash
cd /opt/project-accounting
# "node" direto: o usuário do serviço não tem pasta própria para o cache do npm
sudo -u project-accounting node --env-file=.env intelligence/cli.js check
```

Esperado: `9 de 9 fontes acessíveis`. Se alguma falhar (ex.: bloqueio de IP), ela aparece com o erro; as demais continuam funcionando normalmente. A primeira coleta real pode ser disparada pelo botão **Atualizar agora** no módulo.

## 8. Atualizar a aplicação

Na máquina de desenvolvimento: rode `npm test` e envie ao GitHub (`git push`). Depois, na VPS:

```bash
cd /opt/project-accounting
sudo git pull
sudo systemctl restart project-accounting
curl -s http://127.0.0.1:8080/healthz
```

Reiniciar encerra as sessões abertas (os usuários entram de novo). Se houver coleta em andamento, o serviço aguarda até 25 s para ela terminar.

## 9. Backup (provisório)

Até a rotina automática de backup (próxima etapa), copie a pasta de dados para **fora da VPS** periodicamente:

```bash
scp usuario@ip-da-vps:/var/lib/project-accounting/*.json ./backup-$(date +%F)/
```

## Referência: variáveis do `.env`

| Variável | Produção | Descrição |
|---|---|---|
| `NODE_ENV` | `production` | Exige usuários configurados e cookie `Secure` |
| `HOST` | `127.0.0.1` | Só o Nginx acessa o Node |
| `PORT` | `8080` | Porta interna do Node |
| `TRUST_PROXY` | `true` | Usa o IP real (do Nginx) no limite de tentativas de login |
| `TZ` | `America/Sao_Paulo` | Fuso da coleta diária |
| `AUTH_USERS` | `usuario:hash,...` | Gerado por `npm run auth:hash -- usuario` |
| `SESSION_TTL_HOURS` | `8` | Sessão expira após esse tempo sem uso |
| `DB_FILE` | `/var/lib/project-accounting/db.json` | Projetos |
| `INTEL_DB_FILE` | `/var/lib/project-accounting/intelligence-db.json` | Inteligência Contábil |
| `INTEL_SCHEDULER` | (vazio) | `off` desliga a coleta automática |
| `COOKIE_SECURE` | (vazio) | Só `false` para testar produção sem HTTPS |
