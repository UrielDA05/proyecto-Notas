document.getElementById('btnSalir').onclick = () => {
    localStorage.removeItem('userId');
    window.location.href = 'index.html';
};