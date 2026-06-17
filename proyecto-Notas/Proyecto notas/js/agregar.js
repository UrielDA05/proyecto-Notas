const notaEditar = JSON.parse(localStorage.getItem("notaEditar"));
const formNoteTitle = document.getElementById("formNoteTitle");

// Si venimos de hacer clic en una nota, rellenamos el formulario en modo Edición (UPDATE)
if (notaEditar) {
    if(formNoteTitle) formNoteTitle.textContent = "Editar Nota";
    document.getElementById("titulo").value = notaEditar.title;
    document.getElementById("descripcion").value = notaEditar.content;
    if(notaEditar.color) document.getElementById("color").value = notaEditar.color;
}

document.getElementById('btn-cancelar').onclick = () => {
    localStorage.removeItem("notaEditar");
    window.location.href = "inicio.html";
};

document.getElementById('btn-guardar').onclick = async () => {
    const title = document.getElementById('titulo').value;
    const content = document.getElementById('descripcion').value;
    const color = document.getElementById('color').value;
    const userId = localStorage.getItem('userId');

    if(!title || !content) return alert("Por favor, llena los campos.");

    // Estructura condicional asíncrona para guardar o actualizar
    let url = '/api/notes';
    let method = 'POST';
    let bodyData = { title, content, color, userId };

    if (notaEditar) {
        // Si estamos editando, mandamos el ID de la nota para que el backend la actualice
        bodyData.id = notaEditar.id;
        // Agregamos una propiedad para que el servidor identifique la actualización si es necesario
    }

    await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
    });

    localStorage.removeItem("notaEditar");
    window.location.href = 'inicio.html';
};