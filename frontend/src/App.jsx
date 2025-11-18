import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./app.css"

// Configuração da API
const API = axios.create({
  baseURL: "http://localhost:3000",
  timeout: 8000,
});

// --- UTILS ---
const notEmpty = (v) => String(v ?? "").trim().length > 0;
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export default function App() {
  // --- ESTADO GLOBAL ---
  const [view, setView] = useState("login"); // 'login' | 'home' | 'produtos' | 'estoque'
  const [user, setUser] = useState(null); // {id, nome, email}

  // --- LOGIN ---
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");

  const doLogin = async (e) => {
    e?.preventDefault();
    if (!notEmpty(loginEmail) || !notEmpty(loginSenha)) {
      return alert("Informe email e senha.");
    }
    try {
      const { data } = await API.post("/auth/login", {
        email: loginEmail,
        senha: loginSenha,
      });
      setUser(data);
      setView("home");
      setLoginEmail("");
      setLoginSenha("");
    } catch (err) {
      alert(err?.response?.data?.error || "Falha no login");
    }
  };

  const logout = () => {
    setUser(null);
    setView("login");
  };

  // --- PRODUTOS & ESTOQUE ---
  const [produtos, setProdutos] = useState([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [q, setQ] = useState(""); // busca

  // Form Produto
  const emptyProduto = { id: null, nome: "", quantidade: 0, estoque_minimo: 0 };
  const [produtoForm, setProdutoForm] = useState(emptyProduto);
  const [editandoId, setEditandoId] = useState(null);

  const carregarProdutos = async (term = q) => {
    setLoadingProdutos(true);
    try {
      const url = notEmpty(term) ? `/produtos?q=${encodeURIComponent(term)}` : "/produtos";
      const { data } = await API.get(url);
      setProdutos(Array.isArray(data) ? data : []);
    } catch (e) {
      alert("Erro ao carregar estoque do mercado");
    } finally {
      setLoadingProdutos(false);
    }
  };

  useEffect(() => {
    if (view === "produtos" || view === "estoque") carregarProdutos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const produtosOrdenados = useMemo(() => {
    return [...produtos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
  }, [produtos]);

  const limparProdutoForm = () => {
    setProdutoForm(emptyProduto);
    setEditandoId(null);
  };

  const validarProdutoForm = () => {
    const { nome, quantidade, estoque_minimo } = produtoForm;
    if (!notEmpty(nome)) return "Informe o nome do produto.";
    if (toInt(quantidade) < 0) return "Quantidade não pode ser negativa.";
    if (toInt(estoque_minimo) < 0) return "Estoque mínimo não pode ser negativo.";
    return null;
  };

  const criarProduto = async () => {
    const msg = validarProdutoForm();
    if (msg) return alert(msg);
    try {
      await API.post("/produtos", {
        nome: produtoForm.nome.trim(),
        quantidade: toInt(produtoForm.quantidade),
        estoque_minimo: toInt(produtoForm.estoque_minimo),
      });
      await carregarProdutos();
      limparProdutoForm();
      alert("Produto cadastrado com sucesso!");
    } catch (e) {
      alert(e?.response?.data?.error || "Erro ao criar produto");
    }
  };

  const iniciarEdicao = (p) => {
    setEditandoId(p.id);
    setProdutoForm({
      id: p.id,
      nome: p.nome,
      quantidade: p.quantidade,
      estoque_minimo: p.estoque_minimo,
    });
  };

  const salvarProduto = async () => {
    if (!editandoId) return;
    const msg = validarProdutoForm();
    if (msg) return alert(msg);
    try {
      await API.put(`/produtos/${editandoId}`, {
        nome: produtoForm.nome.trim(),
        quantidade: toInt(produtoForm.quantidade),
        estoque_minimo: toInt(produtoForm.estoque_minimo),
      });
      await carregarProdutos();
      limparProdutoForm();
      alert("Produto atualizado!");
    } catch (e) {
      alert(e?.response?.data?.error || "Erro ao salvar produto");
    }
  };

  const excluirProduto = async (id) => {
    if (!window.confirm("Tem certeza que deseja remover este item do catálogo?")) return;
    try {
      await API.delete(`/produtos/${id}`);
      await carregarProdutos();
    } catch (e) {
      alert(e?.response?.data?.error || "Erro ao excluir produto");
    }
  };

  const buscar = async (e) => {
    e?.preventDefault();
    await carregarProdutos(q);
  };

  // --- GESTÃO DE ESTOQUE (MOVIMENTAÇÕES) ---
  const [movProdutoId, setMovProdutoId] = useState("");
  const [movTipo, setMovTipo] = useState("entrada"); // entrada|saida
  const [movQuantidade, setMovQuantidade] = useState("");
  const [movData, setMovData] = useState("");
  const [movObs, setMovObs] = useState("");

  const enviarMovimentacao = async () => {
    if (!user) return alert("Faça login.");
    if (!movProdutoId) return alert("Selecione um produto.");
    const qtd = toInt(movQuantidade);
    if (!(qtd > 0)) return alert("Informe uma quantidade maior que zero.");

    try {
      const payload = {
        produto_id: Number(movProdutoId),
        usuario_id: user.id,
        tipo: movTipo,
        quantidade: qtd,
        data_movimentacao: notEmpty(movData) ? new Date(movData).toISOString() : null,
        observacao: notEmpty(movObs) ? movObs.trim() : null,
      };
      const { data } = await API.post("/movimentacoes", payload);
      
      let msg = "Movimentação registrada.";
      if (movTipo === 'entrada') msg = "Estoque reabastecido.";
      if (movTipo === 'saida') msg = "Venda/Saída registrada.";
      
      if (data?.produto?.abaixo_do_minimo) {
        msg += "\n⚠️ ATENÇÃO: Estoque abaixo do mínimo!";
      }
      alert(msg);
      
      await carregarProdutos();
      setMovQuantidade("");
      setMovObs("");
    } catch (e) {
      alert(e?.response?.data?.error || "Erro ao registrar movimentação");
    }
  };

  // --- RENDER ---
  return (
    <>
      <div className="app-container">
        
        {/* LOGIN */}
        {view === "login" && (
          <section className="form" aria-label="login">
            <h2>🛒 Mercado SAEP - Acesso</h2>
            <div className="input-container">
              <label>Email Corporativo</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="gerente@mercado.com"
                required
              />
            </div>
            <div className="input-container">
              <label>Senha</label>
              <input
                type="password"
                value={loginSenha}
                onChange={(e) => setLoginSenha(e.target.value)}
                placeholder="•••••••"
                required
              />
            </div>
            <button onClick={doLogin}>Acessar Sistema</button>
          </section>
        )}

        {/* HOME / DASHBOARD */}
        {view === "home" && (
          <section className="form" aria-label="home">
            <h2>Bem-vindo(a), {user?.nome}!</h2>
            <p style={{textAlign: 'center', color: '#666'}}>O que deseja fazer hoje?</p>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: '1fr 1fr' }}>
              <button onClick={() => setView("produtos")}>📋 Catálogo de Produtos</button>
              <button onClick={() => setView("estoque")}>📦 Entrada/Saída (Caixa)</button>
            </div>
            <button className="btn-outline" onClick={logout} >Sair do Sistema</button>
          </section>
        )}

        {/* CADASTRO DE PRODUTOS */}
        {view === "produtos" && (
          <section className="form" aria-label="produtos" >
            <h2>Gerenciar Catálogo</h2>

            {/* Busca */}
            <form onSubmit={buscar} >
              <input
                type="text"
                placeholder="Buscar item (ex.: Detergente, Arroz)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button type="submit">Buscar</button>
              <button type="button" className="btn-outline" onClick={() => { setQ(""); carregarProdutos(""); }}>
                Limpar
              </button>
            </form>

            {/* Formulário */}
            <div style={{ border: '1px solid #eee', padding: 15, borderRadius: 8, marginTop: 10 }}>
              <h3 style={{fontSize: '1.1rem', marginTop: 0}}>
                {editandoId ? "Editar Item" : "Novo Item"}
              </h3>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: '2fr 1fr 1fr' }}>
                <div className="input-container">
                  <label>Nome do Produto</label>
                  <input
                    type="text"
                    value={produtoForm.nome}
                    onChange={(e) => setProdutoForm((s) => ({ ...s, nome: e.target.value }))}
                    placeholder='Ex.: Feijão Carioca 1kg'
                  />
                </div>
                <div className="input-container">
                  <label>Qtd Atual</label>
                  <input
                    type="number"
                    value={produtoForm.quantidade}
                    onChange={(e) => setProdutoForm((s) => ({ ...s, quantidade: e.target.value }))}
                    min={0}
                  />
                </div>
                <div className="input-container">
                  <label>Estoque Mín.</label>
                  <input
                    type="number"
                    value={produtoForm.estoque_minimo}
                    onChange={(e) => setProdutoForm((s) => ({ ...s, estoque_minimo: e.target.value }))}
                    min={0}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                {editandoId ? (
                  <>
                    <button type="button" onClick={salvarProduto}>Salvar Alterações</button>
                    <button type="button" className="btn-outline" onClick={limparProdutoForm}>Cancelar</button>
                  </>
                ) : (
                  <button type="button" onClick={criarProduto}>Cadastrar</button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
               <button type="button" className="btn-outline" onClick={() => setView("home")}>Voltar ao Menu</button>
            </div>

            {/* Tabela */}
            <div style={{ width: "100%", overflowX: 'auto' }}>
              {loadingProdutos && <p>Atualizando catálogo...</p>}
              {!loadingProdutos && (
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th style={{textAlign: 'center'}}>Em Loja</th>
                      <th style={{textAlign: 'center'}}>Mínimo</th>
                      <th style={{textAlign: 'center'}}>Status</th>
                      <th style={{textAlign: 'center'}}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosOrdenados.map((p) => (
                      <tr key={p.id}>
                        <td>{p.nome}</td>
                        <td style={{ textAlign: "center", fontWeight: 'bold' }}>{p.quantidade}</td>
                        <td style={{ textAlign: "center", color: '#777' }}>{p.estoque_minimo}</td>
                        <td style={{ textAlign: "center" }}>
                          {p.quantidade < p.estoque_minimo ? (
                            <span className="estoque-baixo">Repor!</span>
                          ) : (
                            <span className="estoque-ok">OK</span>
                          )}
                        </td>
                        <td style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button className="btn-editar" onClick={() => iniciarEdicao(p)} title="Editar">✏️</button>
                          <button className="btn-excluir" onClick={() => excluirProduto(p.id)} title="Excluir">🗑️</button>
                        </td>
                      </tr>
                    ))}
                    {produtosOrdenados.length === 0 && (
                      <tr><td colSpan={5} style={{textAlign: 'center', padding: 20}}>Nenhum produto encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {/* GESTÃO DE ESTOQUE */}
        {view === "estoque" && (
          <section className="form" aria-label="estoque">
            <h2>Caixa / Reposição</h2>

            {/* Formulário de Movimentação */}
            <div style={{ backgroundColor: '#f1f2f6', padding: 15, borderRadius: 8 }}>
              <h3 style={{marginTop: 0, fontSize: '1rem'}}>Registrar Operação</h3>
              
              <div className="input-container">
                <label>Produto</label>
                <select
                  value={movProdutoId}
                  onChange={(e) => setMovProdutoId(e.target.value)}
                >
                  <option value="">Selecione o item...</option>
                  {produtosOrdenados.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (Atual: {p.quantidade})
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-container">
                <label>Tipo de Operação</label>
                <div style={{ display: "flex", gap: 20, padding: '10px 0' }}>
                  <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5}}>
                    <input type="radio" name="tipo" value="entrada" checked={movTipo === "entrada"} onChange={(e) => setMovTipo(e.target.value)} style={{width: 'auto'}} /> 
                    📥 Entrada (Reposição)
                  </label>
                  <label style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5}}>
                    <input type="radio" name="tipo" value="saida" checked={movTipo === "saida"} onChange={(e) => setMovTipo(e.target.value)} style={{width: 'auto'}} /> 
                    📤 Saída (Venda)
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="input-container">
                  <label>Quantidade</label>
                  <input
                    type="number"
                    min={1}
                    value={movQuantidade}
                    onChange={(e) => setMovQuantidade(e.target.value)}
                    placeholder="Qtd"
                  />
                </div>
                <div className="input-container">
                  <label>Data</label>
                  <input
                    type="date"
                    value={movData}
                    onChange={(e) => setMovData(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-container">
                <label>Observação</label>
                <input
                  type="text"
                  value={movObs}
                  onChange={(e) => setMovObs(e.target.value)}
                  placeholder="Ex.: NF 1020 ou Venda Balcão"
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 15 }}>
                <button type="button" onClick={enviarMovimentacao} style={{flex: 1}}>Confirmar</button>
                <button type="button" className="btn-outline" onClick={() => setView("home")}>Cancelar</button>
              </div>
            </div>

            {/* Resumo Rápido */}
            <div style={{ width: "100%", marginTop: 20 }}>
              <h3>Níveis de Estoque Críticos</h3>
              <ul>
                {produtosOrdenados.filter(p => p.quantidade < p.estoque_minimo).map((p) => (
                  <li key={p.id}>
                    <span>🚨 <b>{p.nome}</b></span>
                    <span>Restam: <b>{p.quantidade}</b> (Mín: {p.estoque_minimo})</span>
                  </li>
                ))}
                {produtosOrdenados.filter(p => p.quantidade < p.estoque_minimo).length === 0 && (
                   <li style={{color: 'green', justifyContent: 'center'}}>Tudo certo! Nenhum produto com estoque baixo.</li>
                )}
              </ul>
            </div>
          </section>
        )}
      </div>
    </>
  );
}