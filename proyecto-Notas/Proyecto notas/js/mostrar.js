async function cargarNotas() {
    const userId = localStorage.getItem('userId');
    if (!userId) window.location.href = "index.html";

    // Tu referencia exacta de la captura image_4639a8.png
    const ul = document.getElementById('listaNotas');
    ul.innerHTML = "";

    try {
        const res = await fetch('/api/notes', {
            headers: { 'user-id': userId }
        });
        const notes = await res.json();

        notes.forEach(nota => {
            const li = document.createElement("li");
            
            // Inyectamos tus clases nativas de los botes de basura (.trash y .trash2)
            li.innerHTML = `
            <div>
                <h1>${nota.title}</h1>
                <p>${nota.content}</p>
            </div>
            <div>
                <button onclick="eliminarNota(event, ${nota.id})">
                    <i class="bi bi-trash-fill trash"></i>
                    <i class="bi bi-trash trash2"></i>
                </button>
            </div>
            `;
            
            // Conserva tus estilos dinámicos de color de fondo seleccionados por el usuario
            if(nota.color) li.style.backgroundColor = nota.color;
            
            ul.appendChild(li);
        });
    } catch (error) {
        console.error("Error al cargar notas asíncronamente:", error);
    }
}

async function eliminarNota(event, id) {
    event.stopPropagation();
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    cargarNotas();
}

window.onload = cargarNotas;