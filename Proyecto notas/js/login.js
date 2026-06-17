
const usuario = localStorage.getItem("usuario");

if (usuario){
    window.location.href = "index.html";
}

const formularioLogin = document.getElementById("formulario-login");

formularioLogin.addEventListener("submit",(evento)=>{
    evento.preventDefault();
    const nombre = document.getElementById("nombre").value;
    const password = document.getElementById("password").value;
    console.log(nombre);

    if(nombre == "admin" && password == "123"){
        localStorage.setItem("usuario", nombre);
        window.location.href = "inicio.html";
    }else{
        alert("Usuario o contraseña incorrectos")
    }
    
})


