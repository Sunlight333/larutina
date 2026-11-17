// Sample reviews, invented for the demo and always labelled as such on the
// page ("Reseñas de ejemplo"). They are never marked up as structured data.
// The real build stores reviews in the Review table with moderation.

export type SampleReview = {
  author: string
  skinType: string
  usingFor: string
  rating: number
  title: string
  body: string
}

export const sampleReviews: Record<string, SampleReview[]> = {
  'gel-limpiador-purificante': [
    { author: 'Martina G.', skinType: 'Grasa', usingFor: '3 meses', rating: 5, title: 'Por fin uno que no me reseca', body: 'Tenía la frente brillando a las 11 de la mañana. Ahora llego a la tarde bastante bien y no siento la cara tirante después de lavarla.' },
    { author: 'Tomás L.', skinType: 'Mixta', usingFor: '1 mes', rating: 4, title: 'Bien para la zona T', body: 'Limpia muy bien. En las mejillas en invierno lo sentí un poco seco, así que a la mañana me lavo solo con agua.' },
  ],
  'crema-limpiadora-suave': [
    { author: 'Lucía F.', skinType: 'Seca', usingFor: '5 meses', rating: 5, title: 'La cara queda suave', body: 'Es lo primero que no me deja la piel tirante. Saca bien el protector; para la máscara de pestañas uso otra cosa.' },
    { author: 'Carolina P.', skinType: 'Sensible', usingFor: '2 meses', rating: 5, title: 'Cero ardor', body: 'Probé mil limpiadores y todos me picaban. Este no. La textura es rara al principio porque no hace espuma, pero te acostumbrás.' },
  ],
  'espuma-limpiadora-equilibrante': [
    { author: 'Julieta M.', skinType: 'Mixta', usingFor: '2 meses', rating: 4, title: 'Muy agradable', body: 'La espuma es suavecita y deja la piel limpia sin tirantez. Lo único, se termina rápido.' },
    { author: 'Nicolás R.', skinType: 'Normal', usingFor: '6 semanas', rating: 5, title: 'Simple y efectiva', body: 'La uso mañana y noche. No reseca y el envase con bomba es cómodo para la ducha.' },
  ],
  'tonico-hidratante': [
    { author: 'Agustina B.', skinType: 'Seca', usingFor: '4 meses', rating: 5, title: 'Alivio inmediato', body: 'Lo aplico con las manos después de lavarme y la piel cambia al toque. Ahora la crema rinde más.' },
    { author: 'Federico S.', skinType: 'Grasa', usingFor: '1 mes', rating: 4, title: 'No suma brillo', body: 'Pensé que me iba a dejar la cara pegajosa y no. No sé si hace mucho solo, pero la piel se siente mejor.' },
  ],
  'tonico-calmante-centella': [
    { author: 'Rocío D.', skinType: 'Sensible', usingFor: '3 meses', rating: 5, title: 'Mi salvavidas', body: 'Los días que tengo la cara colorada me pongo un algodón empapado dos minutos y baja un montón.' },
    { author: 'Paula V.', skinType: 'Seca', usingFor: '2 meses', rating: 5, title: 'Calma de verdad', body: 'Lo uso después de depilarme las cejas y también de noche. No tiene olor y no pica nada.' },
  ],
  'exfoliante-liquido-aha-7': [
    { author: 'Victoria A.', skinType: 'Normal', usingFor: '2 meses', rating: 5, title: 'La textura cambió', body: 'Lo uso dos noches por semana. La piel está más lisa y las manchitas de la frente se ven más claras.' },
    { author: 'Belén C.', skinType: 'Mixta', usingFor: '3 semanas', rating: 4, title: 'Pica un poquito al principio', body: 'Las primeras veces sentí un cosquilleo. Ahora ya no. Ojo con el protector al día siguiente, es en serio.' },
  ],
  'exfoliante-bha-2': [
    { author: 'Joaquín T.', skinType: 'Grasa', usingFor: '4 meses', rating: 5, title: 'Adiós puntos negros', body: 'La nariz me cambió por completo. La primera semana me salieron un par de granitos más y después mejoró mucho.' },
    { author: 'Micaela N.', skinType: 'Mixta', usingFor: '2 meses', rating: 5, title: 'El que más me funcionó', body: 'Lo uso noche por medio solo en la zona T. Los poros se ven más chicos y tengo menos granitos en la pera.' },
  ],
  'serum-niacinamida-10-zinc': [
    { author: 'Florencia G.', skinType: 'Grasa', usingFor: '3 meses', rating: 5, title: 'Controla el brillo', body: 'Llego al final del día con mucho menos brillo, y las marcas de granitos viejos se fueron aclarando.' },
    { author: 'Mateo I.', skinType: 'Mixta', usingFor: '1 mes', rating: 4, title: 'Buenísimo con poca cantidad', body: 'Si me pongo mucho queda pegajoso; con tres gotas va perfecto. Se nota en los poros de la nariz.' },
  ],
  'serum-vitamina-c-15': [
    { author: 'Natalia E.', skinType: 'Normal', usingFor: '3 meses', rating: 5, title: 'Luz en la cara', body: 'La piel se ve más luminosa y la mancha que tenía en el pómulo está más clara. Lo guardo en la heladera.' },
    { author: 'Candela O.', skinType: 'Mixta', usingFor: '2 meses', rating: 4, title: 'Funciona, pero cuidalo', body: 'Me gusta el resultado. Hay que cerrarlo bien porque se oxida. Las primeras veces me picó un poco.' },
  ],
  'serum-acido-hialuronico': [
    { author: 'Josefina K.', skinType: 'Seca', usingFor: '5 meses', rating: 5, title: 'Piel jugosa', body: 'Lo pongo con la cara húmeda y encima la crema. No lo cambio por nada, sobre todo en invierno.' },
    { author: 'Luciana H.', skinType: 'Grasa', usingFor: '2 meses', rating: 5, title: 'Hidrata sin engrasar', body: 'Tenía la piel grasa pero deshidratada y no lo sabía. Con este sérum mejoró la textura sin sumar brillo.' },
  ],
  'serum-acido-azelaico-10': [
    { author: 'Camila R.', skinType: 'Sensible', usingFor: '2 meses', rating: 5, title: 'Menos rojeces', body: 'Tengo la piel que reacciona a todo y esto lo tolero. Las rojeces de las mejillas bajaron bastante.' },
    { author: 'Valentina Q.', skinType: 'Mixta', usingFor: '6 semanas', rating: 4, title: 'Paciencia', body: 'Al principio no veía nada. A las seis semanas se notan menos los granitos y las marcas. Un leve cosquilleo los primeros días.' },
  ],
  'retinol-03-escualano': [
    { author: 'Carolina P.', skinType: 'Normal', usingFor: '4 meses', rating: 5, title: 'Mi primer retinol', body: 'Empecé con dos noches por semana como dice la ficha y no tuve irritación. Las líneas de la frente se ven más suaves.' },
    { author: 'Paula V.', skinType: 'Seca', usingFor: '3 meses', rating: 4, title: 'Suave, como prometía', body: 'Al ser en aceite no me pela como otros retinoles. Tardó en mostrar resultados, pero hoy la piel está más pareja.' },
  ],
  'gel-crema-ligero': [
    { author: 'Martina G.', skinType: 'Grasa', usingFor: '3 meses', rating: 5, title: 'Al fin una crema para mí', body: 'Me salteaba la crema porque todas me engrasaban. Esta se absorbe al toque y el maquillaje dura más.' },
    { author: 'Tomás L.', skinType: 'Mixta', usingFor: '2 meses', rating: 4, title: 'Liviana', body: 'Perfecta para el verano. En invierno, en las mejillas, me quedó un poco corta.' },
  ],
  'crema-reparadora-barrera': [
    { author: 'Rocío D.', skinType: 'Sensible', usingFor: '6 meses', rating: 5, title: 'Me devolvió la piel', body: 'Después de un exceso de ácidos tenía la piel ardida. Con esta crema en dos semanas volví a estar bien.' },
    { author: 'Lucía F.', skinType: 'Seca', usingFor: '4 meses', rating: 5, title: 'Rica sin ser grasosa', body: 'Es espesa pero se absorbe bien. Me dura la hidratación todo el día, incluso con calefacción.' },
  ],
  'crema-con-peptidos': [
    { author: 'Natalia E.', skinType: 'Normal', usingFor: '3 meses', rating: 4, title: 'Linda textura', body: 'La uso de noche. La piel amanece suave y firme. Los resultados en líneas son sutiles, como dicen en la evaluación.' },
    { author: 'Josefina K.', skinType: 'Seca', usingFor: '2 meses', rating: 5, title: 'Alternativa al retinol', body: 'Estoy amamantando y no puedo usar retinol. Esta crema es mi reemplazo y estoy contenta.' },
  ],
  'fluido-protector-fps-50': [
    { author: 'Agustina B.', skinType: 'Mixta', usingFor: '6 meses', rating: 5, title: 'El único que uso todos los días', body: 'No deja la cara blanca ni grasosa, y no me pica en los ojos. Lo uso abajo del maquillaje sin problema.' },
    { author: 'Joaquín T.', skinType: 'Grasa', usingFor: '3 meses', rating: 5, title: 'Toque seco real', body: 'Nunca usaba protector porque odiaba la sensación. Este se siente como nada.' },
  ],
  'protector-mineral-fps-50': [
    { author: 'Camila R.', skinType: 'Sensible', usingFor: '4 meses', rating: 5, title: 'No me irrita', body: 'Todos los protectores me hacían arder los ojos. Este no, y el color apenas rosado no deja marca blanca.' },
    { author: 'Belén C.', skinType: 'Seca', usingFor: '2 meses', rating: 4, title: 'Hidrata además de proteger', body: 'Me gusta cómo queda la piel. Hay que distribuirlo con toques; si frotás mucho, se nota un poco.' },
  ],
  'mascarilla-de-arcilla': [
    { author: 'Florencia G.', skinType: 'Grasa', usingFor: '2 meses', rating: 5, title: 'Mi ritual de los domingos', body: 'Diez minutos y la piel queda mate y suave. No me tira como otras arcillas.' },
    { author: 'Mateo I.', skinType: 'Mixta', usingFor: '1 mes', rating: 4, title: 'Buena para la zona T', body: 'La uso solo en frente y nariz. Si la dejás secar del todo, tira; sacala antes como dice la ficha.' },
  ],
}
