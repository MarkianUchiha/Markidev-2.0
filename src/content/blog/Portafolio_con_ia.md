---
title: "Cómo construí mi portafolio con iA"
description: "Mi experiencia creando un portafolio moderno con Inteligencia Artificial y todo lo que no te cuentan"
pubDate: 2025-11-20
author: "Marco Lara"
image: "/img/blog/mi_port_ia.jpg"
tags: ["ia", "portafolio", "desarrollo web", "gemini"]
draft: false
---

## Programando con iA

Todos hemos visto miles de tutoriales donde con un prompt crean webs, apps y saas increibles, pero en realidad si tú lo intentas no funciona asi o al menos no de forma tan sencilla, y el objetivo de este post es compartirte mi experiencia con la programación con iA.

Y el primer paso era intentar un prompt que hiciera que la iA creara todo de forma perfecta y aqui es donde nace el problema mas grande al trabajar con ia y es transmitirle la idea completa con palabras de manera que entienda a detalle tu visión y si en la vida normal muchas veces no podemos transmitir las ideas, siendo programadores y en especial los desarrolladores que se enfrentan directamente a los clientes, sus peticiones y nuestras interpretaciones casi siempre parece que hablamos en idiomas totalmente diferentes.

Por lo cual tenia 2 caminos el primero era promptaer hasta conseguir algo y lo siguiente era intentar hacer lo basico yo y entre autocompletados y prompts ir construyendo el portfolio, asi que como buen programador de la vieja escuela decidi iniciarlo yo.

Aqui me volvi a topar con el problema inicial y es que yo traia mi stack en la mente pero la iA empezaba a revolver tecnologias y bueno... toco volver a empezar otra vez, me vi algunos videos y puse a la iA a darme recomendaciones, asi que llegue a que con un prompt con instrucciones iniciales podia evitar que se saliera del stack que queria usar, pero nuevamente me volvi a encontrar el problema de la interpretacion y no se si tu has intentado iterar con iA, pero si no lo has hecho... _NO LO HAGAS_

## ¿Por qué elegí no iterar con la iA?

Como te venia platicando eliminaba todo el proyecto y lo volvia a hacer, porque mientras intentaba iterar con la iA en lugar de resolver solo hacia mas probelmas, ya que para hacer los cambios solicitados y resolver los problemas creaba archivos nuevos, no reutilizaba codigo y bueno era todo un caos y la opción de estar deshaciendo el proyecto y perder horas y horas de trabajo era lo peor, sin mencionar los tokens que según los tutoriales puedes hacer muchas cosas con las versiones gratis.

## Un Prompt para controlarlos a todos

Asi que volvi al inicio, parecia que la unica solucion era tomar cursos y leer libros sobre prompt engineering y eso iba a ser una locura, asi que un poco desanimado me puse a ver un live sobre programación con iA que al final resulto ser mas un comercial sobre cursos y bootcamps, que no estan mal, pero no soy fan.

Ahi entre una cosa y otra pude escuchar que podia crear una especie reglas para la ia y si llegaste hasta aqui me parece que ta has sentido identificado con todo lo que te he contado.

Prepare un prompt al que si le dedique bastante tiempo y que lo puedes encontrar en el repositorio de mi github. (aqui va el link) el archivo se llama GEMINI_RULES.md y ahi podras encontrar las reglas que me cambiaron el rumbo de este proyecto.

## Iniciemos

Teniendo ya toda esa experiencia decidi tomar este proyecto muchisimo mas en serio, ya era momento de tomar el control y no dejarle todo a la iA, es mi copiloto no mi proyect manager.

El primer paso era tomarme las cosas como si fuera un proyecto de un cliente, y creo que eso es algo que nos pasa a muchos con los proyectos propios, no les damos tramite igual que el de un cliente.

Y empece por entrevistarme y crear el documento de requeriemientos del proyecto, formule un stack y un diseño de pantallas en boceto y como distribuiria, aprovechando quise crear una pagina dinamica, simple pero con el potencial para escalar y alvergar nuevos proyectos y para eso implemente Astro, tailwind, Typescript y Vite.

Teniendo toda esta documentación lista pase a crear las historias para los sprints (porque odio scrum, pero no puedo vivir sin él) y aprendiendo sobre la enorme cantidad de tokens que se necesitan para hacer funcionar el proyecto decidi elegir a Gemini como mi asistente y developer jr, instale Gemini CLI, Gemini Code Assitant y Gemini Web.

Con todo eso listo arrancamos pnpm astro create e iniciamos.

## La llave del exito

Una vez que tenia el proyecto inicializado y con todo el diseño esperando ser plasmado arrancamos con el primer archivo y mas importante de todos RULES.md y con ello empezamos a programar.

El RULES.md fue la llave del exito, es un documento que contiene todas las reglas para el proyecto, el stack, la estructura de archivos, las tipografias y paletas de colores y todo lo necesario, tambien adjunte el tipo de identado, como manejaria el git y algunas reglas extras como que responda en español y un pro tip "Lee la documentación, compara las versiones del proyecto y despues implementa.

Y para evitar estar
