-- 1. Criação das Tabelas
CREATE TABLE usuarios (
  id_usuario SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL
);

CREATE TABLE produtos (
  id_produto SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  estoque_minimo INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE movimentacoes (
  id_movimentacao SERIAL PRIMARY KEY,
  produto_id INTEGER NOT NULL REFERENCES produtos(id_produto),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id_usuario),
  tipo TEXT NOT NULL,
  quantidade INTEGER NOT NULL,
  data_movimentacao TIMESTAMP NOT NULL DEFAULT NOW(),
  observacao TEXT
);


-- 2. Inserção de Dados Base
INSERT INTO usuarios (nome, email, senha) VALUES
  ('Guilherme Zamboni', 'Gui@gmail.com', '123'),
  ('Eduardo Santos', 'edu@gmail.com', '456'),
  ('Daniel Garcia', 'dan@gmail.com', '789')
ON CONFLICT (email) DO NOTHING;

INSERT INTO produtos (nome, quantidade, estoque_minimo) VALUES
  ('halter', 50, 10),
  ('corda', 60, 10),
  ('colete', 30, 10)
ON CONFLICT DO NOTHING;


-- 3. Inserção de Movimentações (Entradas Iniciais)
INSERT INTO movimentacoes (produto_id, usuario_id, tipo, quantidade, data_movimentacao, observacao) VALUES
  ((SELECT id_produto FROM produtos WHERE nome='halter'),
   (SELECT id_usuario FROM usuarios WHERE email='Gui@gmail.com'),
   'entrada', 30, NOW() - INTERVAL '2 days', 'Compra inicial'),
   
  ((SELECT id_produto FROM produtos WHERE nome='corda'),
   (SELECT id_usuario FROM usuarios WHERE email='Gui@gmail.com'),
   'entrada', 50, NOW() - INTERVAL '3 days', 'Compra inicial'),
   
  ((SELECT id_produto FROM produtos WHERE nome='colete'),
   (SELECT id_usuario FROM usuarios WHERE email='Gui@gmail.com'),
   'entrada', 20, NOW() - INTERVAL '4 days', 'Compra inicial');


-- 4. Inserção de Movimentações (Saídas)
INSERT INTO movimentacoes (produto_id, usuario_id, tipo, quantidade, data_movimentacao, observacao) VALUES
  ((SELECT id_produto FROM produtos WHERE nome='halter'),
   (SELECT id_usuario FROM usuarios WHERE email='edu@gmail.com'),
   'saida', 8, NOW() - INTERVAL '3 day', 'Retirada para evento'),
   
  ((SELECT id_produto FROM produtos WHERE nome='corda'),
   (SELECT id_usuario FROM usuarios WHERE email='edu@gmail.com'),
   'saida', 5, NOW() - INTERVAL '2 day', 'Retirada para feira'),
   
  ((SELECT id_produto FROM produtos WHERE nome='colete'),
   (SELECT id_usuario FROM usuarios WHERE email='edu@gmail.com'),
   'saida', 20, NOW() - INTERVAL '1 day', 'Retirada para divulgação');


-- 5. Inserção de Movimentações (Devoluções)
INSERT INTO movimentacoes (produto_id, usuario_id, tipo, quantidade, observacao) VALUES
  ((SELECT id_produto FROM produtos WHERE nome='halter'),
   (SELECT id_usuario FROM usuarios WHERE email='Gui@gmail.com'),
   'entrada', 14, 'Devolução de kits'),
   
  ((SELECT id_produto FROM produtos WHERE nome='corda'),
   (SELECT id_usuario FROM usuarios WHERE email='edu@gmail.com'),
   'entrada', 16, 'Devolução de kits'),
   
  ((SELECT id_produto FROM produtos WHERE nome='colete'),
   (SELECT id_usuario FROM usuarios WHERE email='dan@gmail.com'),
   'entrada', 18, 'Devolução de kits');