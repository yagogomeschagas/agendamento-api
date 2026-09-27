# Agendamento API — Schema + Autenticação

## Setup

```bash
npm install
cp .env.example .env   # preencha DATABASE_URL e os segredos JWT
psql "$DATABASE_URL" -f schema.sql
npm run dev
```

## Rotas de autenticação

| Método | Rota           | Body                                   |
|--------|----------------|-----------------------------------------|
| POST   | /auth/registro | `{ nome, email, senha, papel? }`        |
| POST   | /auth/login    | `{ email, senha }`                      |
| POST   | /auth/refresh  | `{ refreshToken }`                      |
| POST   | /auth/logout   | `{ refreshToken }`                      |

`papel` no registro aceita `cliente` (padrão) ou `admin` (dono de negócio).
O papel `profissional` é atribuído depois, quando um admin vincula o usuário
a um negócio (rota a implementar: `POST /negocios/:id/profissionais`).

## Como funciona a autenticação

- **Login** retorna um `accessToken` (JWT, expira em 15 min) e um
  `refreshToken` (opaco, expira em 7 dias, guardado no banco só como hash).
- Rotas protegidas exigem `Authorization: Bearer <accessToken>`.
- Quando o access token expira, o cliente chama `/auth/refresh` com o
  refresh token para obter um novo par — o refresh antigo é revogado
  (rotação), então um token roubado só funciona uma vez.
- `/auth/logout` revoga o refresh token, encerrando a sessão.

## Sobre o schema

- `schema.sql` cria todas as tabelas do diagrama ER do planejamento.
- O ponto mais importante: a tabela `agendamentos` tem uma
  **EXCLUDE constraint** (`btree_gist`) que impede, no nível do banco,
  dois agendamentos sobrepostos para o mesmo profissional — mesmo que a
  validação da aplicação falhe. O `server.js` já trata o erro do Postgres
  (`23P01`) e devolve uma resposta 409 amigável.

## Próximos passos sugeridos

1. Rotas de negócios, serviços e profissionais (CRUD protegido por `autorizar('admin')`)
2. Rota de disponibilidade + cálculo de slots livres
3. Rota de criação de agendamento (a EXCLUDE constraint já protege o banco;
   trate o erro 409 no frontend para mostrar "horário não disponível")
4. Cron job de lembretes (ex: `node-cron`, roda diariamente, busca
   agendamentos com `data_hora` entre 23h e 25h a partir de agora)
