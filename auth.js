/* =========================================================
   POSTGUN: LOGIN REAL (Supabase Auth)
   Substitui o login/cadastro/sair de mentira do protótipo.
========================================================= */

// 1. CONFIGURAÇÃO ------------------------------------------------
// Supabase > Project Settings > API. A chave "anon" é pública por design.
// NUNCA coloque a chave "service_role" aqui.
const SUPABASE_URL = "https://trqjkkebvxznflgoftuc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_FJ9jB2VZmaZZeGc1WeIa7w_CvFVKElU";

const configured = !SUPABASE_URL.startsWith("COLE");
const db = configured ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// 2. ELEMENTOS ---------------------------------------------------
const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const feedback = document.getElementById("auth-feedback");

function showFeedback(text, type) {
  feedback.textContent = text;
  feedback.className = "auth-feedback " + (type || "");
}

function setLoading(form, loading) {
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = loading;
  btn.style.opacity = loading ? "0.6" : "1";
}

// Traduz erros do Supabase para mensagens claras
function friendlyError(error) {
  const m = (error.message || "").toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos. Confira e tente de novo.";
  if (m.includes("already registered")) return "Este e-mail já tem conta. Use a aba Entrar.";
  if (m.includes("not confirmed")) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (m.includes("password")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("rate limit")) return "Muitas tentativas seguidas. Aguarde um pouco e tente de novo.";
  return "Algo deu errado. Tente novamente em instantes.";
}

// 3. ENTRAR / SAIR DA TELA PRINCIPAL -----------------------------
function enterApp(name, niche) {
  const displayName = name || "Criadora";
  document.getElementById("welcome-name").textContent = displayName.split(" ")[0];
  document.getElementById("user-display-name").textContent = displayName;
  if (niche) document.getElementById("user-display-niche").textContent = niche;
  document.getElementById("user-avatar-initials").textContent = displayName.slice(0, 2).toUpperCase();
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
}

function leaveApp() {
  appShell.classList.add("hidden");
  authScreen.classList.remove("hidden");
}

// Busca nome e nicho na tabela "profiles" (criada pelo SQL)
async function handleSession(session) {
  if (!session) { leaveApp(); return; }
  const { data } = await db
    .from("profiles")
    .select("full_name, niche")
    .eq("id", session.user.id)
    .maybeSingle();
  const fallbackName = session.user.email.split("@")[0];
  enterApp(data?.full_name || fallbackName, data?.niche);
}

// 4. FORMULÁRIOS -------------------------------------------------
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  showFeedback("");
  if (!configured) return showFeedback("Falta configurar a URL e a chave do Supabase no auth.js.", "err");

  const form = e.target;
  setLoading(form, true);
  const { error } = await db.auth.signInWithPassword({
    email: document.getElementById("login-email").value.trim(),
    password: document.getElementById("login-password").value
  });
  setLoading(form, false);
  if (error) showFeedback(friendlyError(error), "err");
  // Se deu certo, o onAuthStateChange (abaixo) abre o app sozinho.
});

document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  showFeedback("");
  if (!configured) return showFeedback("Falta configurar a URL e a chave do Supabase no auth.js.", "err");

  const form = e.target;
  setLoading(form, true);
  const { data, error } = await db.auth.signUp({
    email: document.getElementById("reg-email").value.trim(),
    password: document.getElementById("reg-password").value,
    options: {
      // Esses dados viram o perfil via trigger no banco
      data: {
        full_name: document.getElementById("reg-name").value.trim(),
        niche: document.getElementById("reg-niche").value
      }
    }
  });
  setLoading(form, false);

  if (error) return showFeedback(friendlyError(error), "err");
  if (!data.session) {
    showFeedback("Conta criada! Enviamos um link de confirmação para o seu e-mail.", "ok");
  }
});

// "Esqueci a senha"
document.querySelector(".link-soft").addEventListener("click", async (e) => {
  e.preventDefault();
  if (!configured) return showFeedback("Falta configurar o Supabase no auth.js.", "err");
  const email = document.getElementById("login-email").value.trim();
  if (!email) return showFeedback("Digite seu e-mail no campo acima e clique em Esqueci a senha.", "err");
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + location.pathname
  });
  if (error) return showFeedback(friendlyError(error), "err");
  showFeedback("Se este e-mail tiver conta, o link de recuperação já está a caminho.", "ok");
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  if (db) await db.auth.signOut();
});

// 5. SESSÃO ------------------------------------------------------
// Roda ao abrir a página e sempre que alguém entra ou sai.
// O Supabase guarda a sessão no navegador, então o usuário continua
// logado ao recarregar (isso substitui o "Lembrar meu acesso").
if (db) {
  db.auth.onAuthStateChange((event, session) => {
    // setTimeout evita travar o cliente do Supabase ao chamar o banco aqui dentro
    setTimeout(() => {
      if (event === "PASSWORD_RECOVERY") {
        const nova = prompt("Digite sua nova senha (mínimo 6 caracteres):");
        if (nova && nova.length >= 6) {
          db.auth.updateUser({ password: nova }).then(({ error }) => {
            if (error) alert(friendlyError(error));
            else alert("Senha atualizada!");
          });
        }
      }
      handleSession(session);
    }, 0);
  });
}
