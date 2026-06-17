const btnSalir = document.getElementById("btn-salir");

btnSalir.addEventListener("click",()=>{
    localStorage.removeItem("usuario")
    window.location.href = "index.html";
})