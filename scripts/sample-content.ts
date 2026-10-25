// Original sample study material for the Sahaj demo (free to reuse).

export type Flow =
  | { kind: 'title'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'figure'; caption: string };

export const SAMPLE_TITLE = 'Chapter 4: How Plants Make Their Food';
export const RUNNING_HEAD = 'Science for Class VII     Chapter 4';
export const RUNNING_FOOT = 'Sahaj sample chapter, free to use for practice';

export const SAMPLE_FLOW: Flow[] = [
  { kind: 'title', text: SAMPLE_TITLE },
  {
    kind: 'para',
    text: 'Every living organism requires food. Food gives us energy to move, grow and repair our bodies. Animals, including humans, obtain food by eating plants or other animals. Green plants are different. They are able to manufacture their own food, and they utilize nothing more than sunlight, water and air to do it. In this chapter we will find out how plants accomplish this remarkable task.',
  },
  { kind: 'heading', text: '4.1 What is Photosynthesis?' },
  {
    kind: 'para',
    text: 'Photosynthesis is the process by which green plants make their own food using sunlight, water and carbon dioxide. The word comes from two Greek words: photo, meaning light, and synthesis, meaning putting together. During photosynthesis, plants put together simple substances to form a sugar called glucose, and oxygen is released into the air as a by-product.',
  },
  {
    kind: 'para',
    text: 'We can write photosynthesis as a simple word equation: carbon dioxide plus water, in the presence of sunlight and chlorophyll, gives glucose plus oxygen. Organisms that make their own food in this way are called autotrophs. Organisms that depend on others for food, such as animals and fungi, are called heterotrophs.',
  },
  { kind: 'heading', text: '4.2 The Leaf: A Food Factory' },
  {
    kind: 'para',
    text: 'Although every green part of a plant can carry out photosynthesis, leaves are the main food factories. A leaf is broad and flat, so it can absorb as much sunlight as possible. Numerous veins run through the leaf and transport water and minerals to every cell.',
  },
  {
    kind: 'para',
    text: 'If you look at the underside of a leaf through a microscope, you will observe tiny pores on its surface. These pores are called stomata. Each pore is surrounded by a pair of guard cells, which open and close the pore. Carbon dioxide from the air enters the leaf through the stomata, and oxygen produced during photosynthesis leaves through them.',
  },
  { kind: 'figure', caption: 'Figure 4.1: A cross-section of a leaf showing stomata, guard cells and chloroplasts.' },
  { kind: 'heading', text: '4.3 The Role of Chlorophyll' },
  {
    kind: 'para',
    text: 'Chlorophyll is a green pigment found in the leaves of plants. It is present inside tiny structures called chloroplasts. Chlorophyll captures the energy of sunlight, and this energy is subsequently used to split water and combine it with carbon dioxide. Without chlorophyll, photosynthesis cannot take place. This is why leaves that are not green, such as the white parts of a variegated leaf, do not produce starch.',
  },
  { kind: 'heading', text: '4.4 Water and Transpiration' },
  {
    kind: 'para',
    text: 'Plants absorb water from the soil through their roots. Root hairs increase the surface area of the roots, so they can take in more water and minerals. The water travels up through the stem in thin tubes called xylem and finally reaches the leaves.',
  },
  {
    kind: 'para',
    text: 'Plants lose a large amount of water as vapour through their stomata. This loss of water from the leaves is called transpiration. Transpiration is not wasteful; it creates a pull that draws water upward from the roots, and it also cools the plant on hot days, much like sweating cools our bodies.',
  },
  { kind: 'heading', text: '4.5 What Happens to the Food?' },
  {
    kind: 'para',
    text: 'The glucose made in the leaves is used by the plant for energy. Extra glucose is converted into starch and stored in different parts of the plant, such as roots, stems, fruits and seeds. Potatoes, rice and wheat are rich in starch because the plant stores its food there. We can test a leaf for starch in the laboratory.',
  },
  {
    kind: 'list',
    items: [
      'Take a leaf from a plant that has been kept in sunlight for several hours.',
      'Boil the leaf in water for one minute, then boil it in alcohol to remove the chlorophyll.',
      'Rinse the leaf in warm water and spread it on a dish.',
      'Add a few drops of iodine solution. A blue-black colour shows that starch is present.',
    ],
  },
  { kind: 'heading', text: '4.6 Why Photosynthesis Matters' },
  {
    kind: 'para',
    text: 'Photosynthesis is the foundation of almost every food chain on Earth. When a deer eats grass, or a tiger eats a deer, the energy they receive was originally captured from sunlight by a plant. Photosynthesis also maintains the level of oxygen in the atmosphere, which nearly all living organisms require for respiration. Consequently, protecting forests and green spaces is essential for life on our planet.',
  },
  {
    kind: 'para',
    text: 'In summary, green plants use chlorophyll to capture sunlight, take in carbon dioxide through their stomata and water through their roots, and make glucose and oxygen. Some of the glucose is used immediately and the rest is stored as starch for later.',
  },
];

/** Paraphrased classroom talk for the "Simulate lecture" demo (seconds, speech). */
export const LECTURE_SCRIPT: { t: number; text: string }[] = [
  { t: 0, text: 'Good morning everyone, please open your notebooks.' },
  { t: 4, text: 'Today we are going to learn how green plants prepare their own food.' },
  { t: 9, text: 'Animals have to eat other living things, but plants only need sunlight, water and air.' },
  { t: 15, text: 'This process of making food with the help of light is what we call photosynthesis.' },
  { t: 21, text: 'Plants combine carbon dioxide and water and make a sugar named glucose, and they give out oxygen.' },
  { t: 28, text: 'Living things that make their own food are autotrophs, and those that depend on others are heterotrophs.' },
  { t: 35, text: 'Now look at the leaf. It is wide and flat so that it can catch a lot of sunlight.' },
  { t: 41, text: 'Under the microscope you can see small holes on the lower side of the leaf. These are the stomata.' },
  { t: 48, text: 'Guard cells open and close these holes to let carbon dioxide in and oxygen out.' },
  { t: 54, text: 'The green colour of the leaf comes from a pigment called chlorophyll, inside the chloroplasts.' },
  { t: 61, text: 'Chlorophyll traps the energy from the sun. Without it the plant cannot make food.' },
  { t: 67, text: 'Next, how does water reach the leaf? The roots and root hairs soak it up from the soil.' },
  { t: 73, text: 'Water goes up the stem through narrow tubes called xylem.' },
  { t: 78, text: 'Some water escapes from the leaves as vapour. This is transpiration, and it keeps the plant cool.' },
  { t: 85, text: 'Extra glucose gets changed into starch and stored in roots, seeds and fruits like potatoes and rice.' },
  { t: 92, text: 'We can check for starch with iodine. If it turns blue black, starch is present.' },
  { t: 98, text: 'Finally, remember that every food chain starts with photosynthesis, and it keeps oxygen in the air.' },
];
