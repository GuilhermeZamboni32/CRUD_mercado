// server.js — mini backend "meia meia meia" (Prova SAEP)
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({
  user: 'postgres',
  password: 'senai',
  host: 'localhost',
  port: 5432,
  database: 'saep_db',
});

app.use(cors());
app.use(express.json());

// utils
const ok = (res, data) => res.json(data);
const fail = (res, err, code = 500) => {
  console.error(err);
  res.status(code).json({ error: typeof err === 'string' ? err : 'Erro interno' });
};

// -----------------------------
// HEALTHCHECK
// -----------------------------
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    ok(res, { status: 'ok' });
  } catch (e) { fail(res, e); }
});

// -----------------------------
// USUÁRIOS
// -----------------------------
app.post('/usuarios', async (req, res) => {
  const { nome, email, senha } = req.body || {};
  if (!nome || !email || !senha) return fail(res, 'Campos obrigatórios: nome, email, senha', 400);
  try {
    const q = `
      INSERT INTO usuarios (nome, email, senha)
      VALUES ($1,$2,$3)
      RETURNING id_usuario AS id, nome, email
    `;
    const r = await pool.query(q, [nome, email, senha]);
    ok(res, r.rows[0]);
  } catch (e) {
    if (String(e?.message).includes('unique')) return fail(res, 'E-mail já cadastrado', 409);
    fail(res, e);
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return fail(res, 'Informe email e senha', 400);
  try {
    const r = await pool.query(
      'SELECT id_usuario AS id, nome, email FROM usuarios WHERE email=$1 AND senha=$2',
      [email, senha]
    );
    if (r.rows.length === 0) return fail(res, 'Credenciais inválidas', 401);
    ok(res, r.rows[0]);
  } catch (e) { fail(res, e); }
});

// -----------------------------
// PRODUTOS
// -----------------------------
app.get('/produtos', async (req, res) => {
  const q = (req.query.q || '').trim();
  const hasQ = q.length > 0;
  const sql = `
    SELECT id_produto AS id, nome, quantidade, estoque_minimo,
           (quantidade < estoque_minimo) AS abaixo_do_minimo
      FROM produtos
     ${hasQ ? 'WHERE lower(nome) LIKE lower($1)' : ''}
     ORDER BY nome ASC
  `;
  try {
    const args = hasQ ? [`%${q}%`] : [];
    const r = await pool.query(sql, args);
    ok(res, r.rows);
  } catch (e) { fail(res, e); }
});

app.get('/produtos/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id_produto AS id, nome, quantidade, estoque_minimo,
              (quantidade < estoque_minimo) AS abaixo_do_minimo
         FROM produtos WHERE id_produto=$1`,
      [req.params.id]
    );
    if (!r.rows.length) return fail(res, 'Produto não encontrado', 404);
    ok(res, r.rows[0]);
  } catch (e) { fail(res, e); }
});

app.post('/produtos', async (req, res) => {
  const { nome, quantidade = 0, estoque_minimo = 0 } = req.body || {};
  if (!nome) return fail(res, 'Campo obrigatório: nome', 400);
  try {
    const r = await pool.query(
      `INSERT INTO produtos (nome, quantidade, estoque_minimo)
       VALUES ($1,$2,$3)
       RETURNING id_produto AS id, nome, quantidade, estoque_minimo`,
      [nome, Number(quantidade) || 0, Number(estoque_minimo) || 0]
    );
    ok(res, r.rows[0]);
  } catch (e) { fail(res, e); }
});

app.put('/produtos/:id', async (req, res) => {
  const { nome, quantidade, estoque_minimo } = req.body || {};
  try {
    const r = await pool.query(
      `UPDATE produtos
          SET nome = COALESCE($1, nome),
              quantidade = COALESCE($2, quantidade),
              estoque_minimo = COALESCE($3, estoque_minimo)
        WHERE id_produto=$4
      RETURNING id_produto AS id, nome, quantidade, estoque_minimo`,
      [nome ?? null, quantidade ?? null, estoque_minimo ?? null, req.params.id]
    );
    if (!r.rows.length) return fail(res, 'Produto não encontrado', 404);
    ok(res, r.rows[0]);
  } catch (e) { fail(res, e); }
});

app.delete('/produtos/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM produtos WHERE id_produto=$1 RETURNING id_produto',
      [req.params.id]
    );
    if (!r.rows.length) return fail(res, 'Produto não encontrado', 404);
    ok(res, { message: 'Produto excluído' });
  } catch (e) { fail(res, e); }
});

// -----------------------------
// MOVIMENTAÇÕES
// -----------------------------
app.post('/movimentacoes', async (req, res) => {
  const { produto_id, usuario_id, tipo, quantidade, data_movimentacao, observacao } = req.body || {};
  if (!produto_id || !usuario_id || !tipo || !quantidade)
    return fail(res, 'Campos obrigatórios: produto_id, usuario_id, tipo, quantidade', 400);

  if (!['entrada', 'saida'].includes(String(tipo).toLowerCase()))
    return fail(res, "tipo deve ser 'entrada' ou 'saida'", 400);

  const delta = String(tipo).toLowerCase() === 'entrada'
    ? +Math.abs(quantidade)
    : -Math.abs(quantidade);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // atualiza produto
    const up = await client.query(
      `UPDATE produtos
          SET quantidade = quantidade + $1
        WHERE id_produto=$2
        RETURNING id_produto AS id, nome, quantidade, estoque_minimo`,
      [delta, produto_id]
    );
    if (!up.rows.length) {
      await client.query('ROLLBACK');
      client.release();
      return fail(res, 'Produto não encontrado', 404);
    }

    // registra movimentação
    const ins = await client.query(
      `INSERT INTO movimentacoes (produto_id, usuario_id, tipo, quantidade, data_movimentacao, observacao)
       VALUES ($1,$2,$3,$4,COALESCE($5, NOW()),$6)
       RETURNING id_movimentacao AS id, produto_id, usuario_id, tipo, quantidade, data_movimentacao, observacao`,
      [produto_id, usuario_id, String(tipo).toLowerCase(), Math.abs(quantidade), data_movimentacao || null, observacao || null]
    );

    await client.query('COMMIT');
    client.release();

    ok(res, {
      movimento: ins.rows[0],
      produto: {
        ...up.rows[0],
        abaixo_do_minimo: up.rows[0].quantidade < up.rows[0].estoque_minimo,
      },
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    client.release();
    fail(res, e);
  }
});

app.get('/movimentacoes', async (req, res) => {
  const { produto_id } = req.query;
  const hasFilter = !!produto_id;
  const sql = `
    SELECT m.id_movimentacao AS id,
           m.produto_id,
           p.nome AS produto_nome,
           m.usuario_id,
           u.nome AS responsavel_nome,
           m.tipo,
           m.quantidade,
           m.data_movimentacao,
           m.observacao
      FROM movimentacoes m
      JOIN produtos p ON p.id_produto = m.produto_id
      JOIN usuarios u ON u.id_usuario = m.usuario_id
     ${hasFilter ? 'WHERE m.produto_id = $1' : ''}
     ORDER BY m.data_movimentacao DESC, m.id_movimentacao DESC
  `;
  try {
    const r = await pool.query(sql, hasFilter ? [produto_id] : []);
    ok(res, r.rows);
  } catch (e) { fail(res, e); }
});

// -----------------------------
// START
// -----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
