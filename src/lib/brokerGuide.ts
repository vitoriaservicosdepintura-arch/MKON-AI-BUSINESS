/** Guia para corretores: os prompts transcritos das imagens do conteúdo. Copiáveis no ecrã Imóveis tour 3D. */
export type GuidePrompt = { label: string; title: string; intro: string; prompt: string }

export const BROKER_GUIDE: GuidePrompt[] = [
  {
    label: 'Imóveis · 6/7',
    title: 'O tour do anúncio',
    intro: 'Para corretor: um tour que o comprador faz sem sair de casa.',
    prompt: 'Adicione um modo de tour guiado. A câmera desliza pela casa na ordem em que um comprador andaria, uns 90 segundos no total. Mostre uma legenda de uma linha em cada cômodo, escrita como anúncio: pra que o cômodo é ótimo, não só o tamanho. Adicione um botão Começar Tour.',
  },
  {
    label: 'Reforma · 5/7',
    title: 'A prévia da reforma',
    intro: 'Veja a mudança antes de pagar a obra.',
    prompt: 'Faça uma cópia da casa com estas mudanças: [tirar a parede entre a cozinha e a sala, pôr uma ilha]. Adicione um botão que alterna entre antes e depois, e destaque o que mudou. Depois liste o que essa mudança envolve (paredes estruturais, hidráulica, elétrica, alvará), pra eu saber o que perguntar pro meu empreiteiro.',
  },
  {
    label: 'Controle de qualidade · 4/7',
    title: 'O crítico implacável',
    intro: 'O truque: um Claude constrói e outro, novo, julga. Abra um chat novo pra isso.',
    prompt: 'Você é um crítico rigoroso. Você não construiu isto. Vou te mandar um print de cada cômodo ao lado da foto que ele deveria igualar. Pra cada par: dê uma nota de 1 a 10, aponte a maior diferença e me diga exatamente o que mudar. Nota 7 não é pronto. Cole as notas de volta no chat da construção. Repita até todo cômodo tirar 9.',
  },
  {
    label: 'Design · 3/7',
    title: 'A designer de interiores',
    intro: 'Caixa vazia não vende. Casa mobiliada vende.',
    prompt: 'Mobilie cada cômodo no estilo [casa de campo moderna]. Siga estas fotos pro piso, os armários, a iluminação e as cores: [anexe as fotos]. As fotos são a régua. Use tamanhos reais de móveis e deixe pelo menos 90 cm pra circular em volta de tudo. Luz do dia quente entrando pelas janelas. Depois liste tudo o que você não conseguiu igualar.',
  },
  {
    label: 'Tour 3D',
    title: 'O tour 3D',
    intro: 'Um arquivo só. Abre em qualquer navegador. Você anda pela casa como num videogame.',
    prompt: 'Agora construa como uma cena three.js num arquivo só, que eu possa percorrer em primeira pessoa. Mantenha a escala: pé-direito de 2,7 m, olhos a 1,65 m, paredes que eu não atravesso. WASD pra andar, clicar e arrastar pra olhar em volta. Portas abertas, janelas deixando a luz entrar. Mostre o nome do cômodo quando eu entrar nele e ponha um minimapa com um ponto de "você está aqui" no canto.',
  },
  {
    label: 'Planta',
    title: 'Ler a planta de volta',
    intro: 'Faça o Claude ler a planta de volta pra você antes de construir qualquer coisa. É daí que vem a precisão.',
    prompt: 'Aqui está uma planta baixa. Antes de construir qualquer coisa, leia ela de volta pra mim como uma tabela: cada cômodo, o tamanho, as portas e janelas, e com quais cômodos ele se liga. Use as medidas impressas na planta. Some a metragem e confira com o total da planta. Se algo não estiver claro, me pergunte em vez de chutar.',
  },
]
