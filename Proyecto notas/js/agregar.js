
const btnCancelar = document.getElementById("btn-cancelar");
if (btnCancelar) {
    btnCancelar.addEventListener("click", function() {
        localStorage.removeItem("notaEditar");
        window.location.href = "inicio.html";
    });
}

const formulario = document.getElementById("nuevaNota");
const notaEditar = JSON.parse(localStorage.getItem("notaEditar"));

if (notaEditar) {
    if(document.getElementById("titulo")) document.getElementById("titulo").value = notaEditar.titulo; 
    if(document.getElementById("descripcion")) document.getElementById("descripcion").value = notaEditar.descripcion;
    if(document.getElementById("color")) document.getElementById("color").value = notaEditar.color;
    if(document.getElementById("fecha")) document.getElementById("fecha").value = notaEditar.fecha;
}


formulario.addEventListener("submit", (e) => {
    e.preventDefault();
    
    let notas = JSON.parse(localStorage.getItem("notas")) || [];


    const notaNueva = {
        titulo: document.getElementById("titulo").value,
        descripcion: document.getElementById("descripcion").value,
        color: document.getElementById("color").value,
        fecha: document.getElementById("fecha").value, 
        id: notaEditar ? notaEditar.id : Date.now() 
    };

    if (notaEditar) {
        // Actualizar nota existente
        notas = notas.map((nota) => {
            if (nota.id === notaEditar.id) {
                return notaNueva;
            }
            return nota;
        });
        localStorage.removeItem("notaEditar");
    } else {
        // Agregar nota nueva
        notas.push(notaNueva);
    }

    localStorage.setItem("notas", JSON.stringify(notas));
    window.location.href = "inicio.html";
});


const usuario = localStorage.getItem("usuario");
if (!usuario) {
    window.location.href = "index.html";
}

/*let notas = JSON.parse(localStorage.getItem("notas")) || [] ; hacer el arreglo

/* document.querySelector("form"); se asigna valor a una variable
/* se puede acceder por tipo d elemento sin ID

/* var color = #157789

const seleccionarColor = (colorbtn)=>{
        color = colorbtn
    }

formulario.addEventListener("submit",(evt)=>{
    evt.preventDefault();
    



    */




/*
localStorage.getItem("nombre_campo") //leer los datos como cadena de texto

localStorage.setItem("nombre_campo",valor) //ingresar cadenas de texto (json)

localStorage.removeItem("nombre_campo") //elimina el capo especificado
*/
/*
[
    {
        titulo,
        descripcion,
        color,
        id:Date.now()
    },
    {
        titulo,
        descripcion,
        color,
        id:Date.now()
    },
]

localStorage.setItem("notas",JSON.stringify(arreglo)); agregar notas 

JSON.parse(localStorage.getItem("notas")); obtener las notas
localStorage.getItem("notas")
*/
//TODO: obtener los elementos de el formulario (titulo, descripcion y color)
//se guarde localStorage con la llave notas
// y que redirija al login si no esta la secion iniciada