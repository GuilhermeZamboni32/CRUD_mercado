-- 1. Criação das Tabelas (Mantida a estrutura, pois serve para o Mercado)
CREATE TABLE usuarios (
  id_usuario SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL
);

CREATE TABLE produtos (
  id_produto SERIAL PRIMARY KEY,
  nome TEXT NOT NULL, -- Ex: Arroz, Feijão, Refrigerante
  quantidade INTEGER NOT NULL DEFAULT 0,
  estoque_minimo INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE movimentacoes (
  id_movimentacao SERIAL PRIMARY KEY,
  produto_id INTEGER NOT NULL REFERENCES produtos(id_produto),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id_usuario),
  tipo TEXT NOT NULL, -- 'entrada' ou 'saida'
  quantidade INTEGER NOT NULL,
  data_movimentacao TIMESTAMP NOT NULL DEFAULT NOW(),
  observacao TEXT
);

-- 2. Inserção de Dados Base (Usuários - Equipe do Mercado)
INSERT INTO usuarios (nome, email, senha) VALUES
  ('Gerente Guilherme', 'gerente@mercado.com', '123'),
  ('Caixa Eduardo', 'caixa1@mercado.com', '456'),
  ('Repositor Daniel', 'repositor@mercado.com', '789')
ON CONFLICT (email) DO NOTHING;

-- 3. Inserção de Produtos (Itens de Mercado em vez de Academia)
INSERT INTO produtos (nome, quantidade, estoque_minimo) VALUES
  ('Arroz 5kg', 50, 20),
  ('Coca-Cola 2L', 100, 30),
  ('Sabão em Pó', 40, 15)
ON CONFLICT DO NOTHING;

-- 4. Inserção de Movimentações (Estoque Inicial)
INSERT INTO movimentacoes (produto_id, usuario_id, tipo, quantidade, data_movimentacao, observacao) VALUES
  ((SELECT id_produto FROM produtos WHERE nome='Arroz 5kg'),
   (SELECT id_usuario FROM usuarios WHERE email='gerente@mercado.com'),
   'entrada', 30, NOW() - INTERVAL '2 days', 'Estoque inicial Arroz'),
   
  ((SELECT id_produto FROM produtos WHERE nome='Coca-Cola 2L'),
   (SELECT id_usuario FROM usuarios WHERE email='gerente@mercado.com'),
   'entrada', 50, NOW() - INTERVAL '3 days', 'Estoque inicial Bebidas'),
   
  ((SELECT id_produto FROM produtos WHERE nome='Sabão em Pó'),
   (SELECT id_usuario FROM usuarios WHERE email='gerente@mercado.com'),
   'entrada', 20, NOW() - INTERVAL '4 days', 'Estoque inicial Limpeza');

-- 5. Inserção de Movimentações (Saídas - Vendas)
INSERT INTO movimentacoes (produto_id, usuario_id, tipo, quantidade, data_movimentacao, observacao) VALUES
  ((SELECT id_produto FROM produtos WHERE nome='Arroz 5kg'),
   (SELECT id_usuario FROM usuarios WHERE email='caixa1@mercado.com'),
   'saida', 8, NOW() - INTERVAL '3 day', 'Venda no caixa 1'),
   
  ((SELECT id_produto FROM produtos WHERE nome='Coca-Cola 2L'),
   (SELECT id_usuario FROM usuarios WHERE email='caixa1@mercado.com'),
   'saida', 15, NOW() - INTERVAL '2 day', 'Venda grande fim de semana'),
   
  ((SELECT id_produto FROM produtos WHERE nome='Sabão em Pó'),
   (SELECT id_usuario FROM usuarios WHERE email='caixa1@mercado.com'),
   'saida', 5, NOW() - INTERVAL '1 day', 'Venda avulsa');

-- 6. Inserção de Movimentações (Reposição/Devoluções)
INSERT INTO movimentacoes (produto_id, usuario_id, tipo, quantidade, observacao) VALUES
  ((SELECT id_produto FROM produtos WHERE nome='Arroz 5kg'),
   (SELECT id_usuario FROM usuarios WHERE email='repositor@mercado.com'),
   'entrada', 20, 'Reposição de gôndola'),
   
  ((SELECT id_produto FROM produtos WHERE nome='Coca-Cola 2L'),
   (SELECT id_usuario FROM usuarios WHERE email='repositor@mercado.com'),
   'entrada', 40, 'Chegada de caminhão'),
   
  ((SELECT id_produto FROM produtos WHERE nome='Sabão em Pó'),
   (SELECT id_usuario FROM usuarios WHERE email='repositor@mercado.com'),
   'entrada', 10, 'Reposição estoque');