async function sair() {
    const { error } = await _supabase.auth.signOut();
    
    if (error) {
        alert("Erro ao sair: " + error.message);
    } else {
        // Remove qualquer dado da sessão e volta para o login
        window.location.href = "index.html";
    }
}