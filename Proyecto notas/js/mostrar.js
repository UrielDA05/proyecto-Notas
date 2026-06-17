const usuario = localStorage.getItem("usuario")
if(!usuario) window.location.href = "index.html"

let notas = JSON.parse(localStorage.getItem("notas")) || [];
const ul = document.querySelector("ul")

ul.innerHTML = "";

notas.map(function(nota){
    const li = document.createElement("li");
    li.innerHTML = `
    <div>
        <h1>${nota.titulo}</h1>
        <p> ${nota.descripcion}</p>
    </div>
    <div>
        <button onclick= "eliminar(${nota.id})">
            <i class="bi bi-trash-fill trash"></i>
            <i class="bi bi-trash trash2"></i>
        </button>
    </div>
    `;
    li.style.backgroundColor = nota.color;
    ul.appendChild(li);
    li.addEventListener("click",(evt)=>{
        if(evt.target.closest("button")) return;

        localStorage.setItem("notaEditar",JSON.stringify(nota));

        window.location.href = "agregar.html"
    });
});

function eliminar(id){
    notas = notas.filter(nota=>nota.id!=id);
    localStorage.setItem("notas", JSON.stringify(notas));
    window.location.href="inicio.html"
}

// describir eventos
// codigo que se implemento, toda la funcionalidad
// flexbox froggy
