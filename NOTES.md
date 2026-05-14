# Notas da implementacao

## Decisoes principais

- A API rejeita entradas negativas e valores nao finitos com `400`, mesmo que o algoritmo de dominio preserve o comportamento original de retornar `0` para entradas nao processaveis.
- As respostas HTTP usam o formato `ServiceResponse` ja existente no projeto.
- O historico usa paginacao por cursor. O cursor e o `id` do ultimo item recebido na pagina anterior.
- O limite padrao do historico e `10`, com maximo de `50`.

## Calculo assíncrono

- O endpoint `POST /square-root/calculate` executa o calculo em `worker_threads`.
- A thread principal fica responsavel pela validacao, resposta HTTP e persistencia.
- O worker instancia `SqrtCalculator` com `NewtonRaphsonAlgorithm`, mantendo o modelo de dominio pedido no README.

## Persistencia

- A persistencia usa Prisma com SQLite.
- O modelo criado foi `Calculation`, com `id`, `input`, `result` e `createdAt`.
- O banco local fica em `server/prisma/dev.db`, ignorado pelo Git.
- Foi adicionado um aplicador de migrations em Node (`server/scripts/apply-sqlite-migrations.mjs`) porque o comando de aplicacao do schema do Prisma falhou neste ambiente Windows com `Schema engine error`, embora o schema valide e o client gere normalmente.

## Bonus

- Cache em memoria para reutilizar resultados de inputs repetidos durante a vida do processo.
- Swagger/OpenAPI disponivel em `/docs` e JSON em `/docs/openapi.json`.
- UI com optimistic clear, atualizacao imediata do historico apos calculo, estados de loading e tratamento de erro.
- Importacao Excel como extra:
  - endpoint `POST /square-root/history/import` recebe `.xlsx` com coluna `input`;
  - a planilha aceita ate 1000 linhas de dados;
  - linhas validas sao calculadas e salvas no historico;
  - linhas invalidas nao bloqueiam as validas e voltam no resumo com numero da linha e motivo;
  - o calculo em lote tambem usa `worker_threads`, evitando bloquear a thread principal;
  - o arquivo original fica salvo em `UPLOAD_DIR` e pode ser baixado por `/square-root/imports/:id/download`.
- Exportacao Excel em `GET /square-root/history/export`, gerando uma planilha com `Input`, `Result`, `Created At`, `Source` e `Source Row`.
- A tabela do frontend agora usa paginacao visual com `Previous`, `Next`, `Refresh` e indicador de pagina.
- Docker e GitHub Actions para deploy em VPS:
  - `development` publica imagem `ghcr.io/cledson96/back-end-test:development` e usa `sqrt-dev.cledson.com.br`.
  - `main` publica imagem `ghcr.io/cledson96/back-end-test:latest` e usa `sqrt.cledson.com.br`.
- O GitHub Actions tambem executa smoke test e stress test da API antes do deploy:
  - sobe o build do servidor em modo producao dentro do runner;
  - valida Swagger, calculo, historico e limpeza de historico;
  - executa requisicoes concorrentes e publica total, sucesso, falhas, latencia media, p95 e requisicoes por segundo no resumo do Actions.

## Melhorias futuras

- Adicionar testes de interface com Playwright ou Testing Library.
- Trocar SQLite por PostgreSQL se o historico crescer ou houver multiplas replicas da aplicacao.
- Adicionar autenticacao no Swagger se a API crescer alem do escopo do teste.
