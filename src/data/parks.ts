export interface Ride {
  id: string;
  name: string;
  parkArea: string;
  onRideTime: number;
  weatherEffect: number;
  waitTimes: {
    morning: [number, number];
    afternoon: [number, number];
    evening: [number, number];
  };
}

export interface Park {
  rides: Ride[];
}

export const PARKS: Record<string, Park> = {
  "Magic Kingdom": {
  rides: [
    { id: "pirates", name: "Pirates of the Caribbean", parkArea: "Adventureland", onRideTime: 9, weatherEffect: 0, waitTimes: { morning: [15,50], afternoon: [10,40], evening: [5,15] }},
    { id: "haunted", name: "Haunted Mansion", parkArea: "Liberty Square", onRideTime: 8, weatherEffect: 0, waitTimes: { morning: [25,60], afternoon: [15,50], evening: [15,30] }},
    { id: "space", name: "Space Mountain", parkArea: "Tomorrowland", onRideTime: 3, weatherEffect: 0, waitTimes: { morning: [30,75], afternoon: [25,70], evening: [5,45] }},
    { id: "smallworld", name: "it's a small world", parkArea: "Fantasyland", onRideTime: 11, weatherEffect: 0, waitTimes: { morning: [5,40], afternoon: [5,30], evening: [5,10] }},
    { id: "cruise", name: "Jungle Cruise", parkArea: "Adventureland", onRideTime: 9, weatherEffect: 1, waitTimes: { morning: [35,70], afternoon: [15,60], evening: [5,35] }},
    { id: "speedway", name: "Tomorrowland Speedway", parkArea: "Tomorrowland", onRideTime: 5, weatherEffect: 1, waitTimes: { morning: [5,30], afternoon: [5,25], evening: [5,15] }},
    { id: "peterpan", name: "Peter Pan's Flight", parkArea: "Fantasyland", onRideTime: 3, weatherEffect: 0, waitTimes: { morning: [45,85], afternoon: [40,80], evening: [15,50] }},
    { id: "carrousel", name: "Prince Charming Regal Carrousel", parkArea: "Fantasyland", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [5,15], afternoon: [5,15], evening: [5,15] }},
    { id: "teacups", name: "Mad Tea Party", parkArea: "Fantasyland", onRideTime: 2, weatherEffect: 0, waitTimes: { morning: [5,20], afternoon: [5,15], evening: [5,5] }},
    { id: "dumbo", name: "Dumbo the Flying Elephant", parkArea: "Fantasyland", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [5,40], afternoon: [5,25], evening: [5,5] }},
    { id: "progress", name: "Walt Disney's Carousel of Progress", parkArea: "Tomorrowland", onRideTime: 21, weatherEffect: 0, waitTimes: { morning: [5,5], afternoon: [5,5], evening: [5,5] }},
    { id: "peoplemover", name: "Tomorrowland Transit Authority PeopleMover", parkArea: "Tomorrowland", onRideTime: 10, weatherEffect: 0, waitTimes: { morning: [5,20], afternoon: [5,20], evening: [5,10] }},
    { id: "thunder", name: "Big Thunder Mountain Railroad", parkArea: "Frontierland", onRideTime: 4, weatherEffect: 1, waitTimes: { morning: [20,60], afternoon: [15,50], evening: [5,30] }},
    { id: "orbiter", name: "Astro Orbiter", parkArea: "Tomorrowland", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [15,45], afternoon: [15,40], evening: [5,30] }},
    { id: "barnstormer", name: "The Barnstormer", parkArea: "Fantasyland", onRideTime: 1, weatherEffect: 1, waitTimes: { morning: [5,40], afternoon: [5,35], evening: [5,5] }},
    { id: "buzz", name: "Buzz Lightyear's Space Ranger Spin", parkArea: "Tomorrowland", onRideTime: 4, weatherEffect: 0, waitTimes: { morning: [15,55], afternoon: [10,45], evening: [5,15] }},
    { id: "pooh", name: "The Many Adventures of Winnie the Pooh", parkArea: "Fantasyland", onRideTime: 3, weatherEffect: 0, waitTimes: { morning: [20,45], afternoon: [15,45], evening: [5,20] }},
    { id: "aladdin", name: "The Magic Carpets of Aladdin", parkArea: "Adventureland", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [5,35], afternoon: [5,25], evening: [5,10] }},
    { id: "tron", name: "TRON Lightcycle Run", parkArea: "Tomorrowland", onRideTime: 1, weatherEffect: 0, waitTimes: { morning: [30,95], afternoon: [115,170], evening: [130,205] }},
    { id: "ariel", name: "Under the Sea Journey of The Little Mermaid", parkArea: "Fantasyland", onRideTime: 6, weatherEffect: 0, waitTimes: { morning: [5,40], afternoon: [5,35], evening: [5,10] }},
    { id: "sdmt", name: "Seven Dwarfs Mine Train", parkArea: "Fantasyland", onRideTime: 3, weatherEffect: 1, waitTimes: { morning: [55,105], afternoon: [45,95], evening: [25,70] }},
    { id: "tianas", name: "Tiana's Bayou Adventure", parkArea: "Frontierland", onRideTime: 11, weatherEffect: 1, waitTimes: { morning: [40,70], afternoon: [60,95], evening: [50,80] }},
  ],
},
EPCOT: {
  rides: [
    { id: "soarin", name: "Soarin'", parkArea: "World Nature", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [15,60], afternoon: [15,45], evening: [10,20] }},
    { id: "testtrack", name: "Test Track", parkArea: "World Discovery", onRideTime: 4, weatherEffect: 1, waitTimes: { morning: [40,85], afternoon: [30,70], evening: [10,40] }},
    { id: "frozen", name: "Frozen Ever After", parkArea: "World Showcase", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [45,95], afternoon: [40,85], evening: [5,30] }},
    { id: "spaceship", name: "Spaceship Earth", parkArea: "World Celebration", onRideTime: 15, weatherEffect: 0, waitTimes: { morning: [5,30], afternoon: [5,15], evening: [5,5] }},
    { id: "goat", name: "Living with the Land", parkArea: "World Nature", onRideTime: 14, weatherEffect: 0, waitTimes: { morning: [5,20], afternoon: [5,5], evening: [5,5] }},
    { id: "remys", name: "Remy's Ratatouille Adventure", parkArea: "World Showcase", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [45,100], afternoon: [45,95], evening: [5,30] }},
    { id: "guardians", name: "Guardians of the Galaxy: Cosmic Rewind", parkArea: "World Discovery", onRideTime: 3, weatherEffect: 0, waitTimes: { morning: [35,105], afternoon: [125,175], evening: [20,195] }},
    { id: "figment", name: "Journey Into Imagination With Figment", parkArea: "World Nature", onRideTime: 11, weatherEffect: 0, waitTimes: { morning: [5,25], afternoon: [5,15], evening: [5,5] }},
    { id: "mission", name: "Mission: SPACE", parkArea: "World Discovery", onRideTime: 6, weatherEffect: 0, waitTimes: { morning: [10,45], afternoon: [10,35], evening: [10,15] }},
    { id: "nemo", name: "The Seas with Nemo & Friends", parkArea: "World Nature", onRideTime: 6, weatherEffect: 0, waitTimes: { morning: [5,25], afternoon: [5,10], evening: [5,5] }},
    { id: "fiesta", name: "Gran Fiesta Tour Starring The Three Caballeros", parkArea: "World Showcase", onRideTime: 8, weatherEffect: 0, waitTimes: { morning: [5,15], afternoon: [5,15], evening: [5,10] }},
  ],
},
"Hollywood Studios": {
  rides: [
    { id: "rise", name: "Rise of the Resistance", parkArea: "Galaxy's Edge", onRideTime: 18, weatherEffect: 0, waitTimes: { morning: [55,120], afternoon: [35,95], evening: [10,50] }},
    { id: "slinky", name: "Slinky Dog Dash", parkArea: "Toy Story Land", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [60,120], afternoon: [50,110], evening: [15,45] }},
    { id: "aliens", name: "Alien Swirling Saucers", parkArea: "Toy Story Land", onRideTime: 2, weatherEffect: 0, waitTimes: { morning: [15,50], afternoon: [5,35], evening: [5,10] }},
    { id: "smugglers", name: "Smuggler's Run", parkArea: "Galaxy's Edge", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [30,95], afternoon: [10,60], evening: [5,35] }},
    { id: "startours", name: "Star Tours", parkArea: "Echo Lake", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [10,25], afternoon: [25,40], evening: [20,35] }},
    { id: "tower", name: "The Twilight Zone Tower of Terror", parkArea: "Sunset Boulevard", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [30,90], afternoon: [25,80], evening: [15,40] }},
    { id: "rock", name: "Rock 'n' Roller Coaster", parkArea: "Sunset Boulevard", onRideTime: 1, weatherEffect: 0, waitTimes: { morning: [35,95], afternoon: [30,90], evening: [5,15] }},
    { id: "railway", name: "Mickey & Minnie's Runaway Railway", parkArea: "Chinese Theater", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [40,80], afternoon: [20,70], evening: [5,20] }},
    { id: "mania", name: "Toy Story Mania", parkArea: "Toy Story Land", onRideTime: 8, weatherEffect: 0, waitTimes: { morning: [35,80], afternoon: [15,70], evening: [5,25] }},
  ],
},
"Animal Kingdom": {
  rides: [
    { id: "flight", name: "Flight of Passage", parkArea: "Pandora", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [60,130], afternoon: [45,115], evening: [25,40] }},
    { id: "safari", name: "Kilimanjaro Safaris", parkArea: "Africa", onRideTime: 19, weatherEffect: 1, waitTimes: { morning: [10,70], afternoon: [5,15], evening: [25,45] }},
    { id: "river", name: "Na'vi River Journey", parkArea: "Pandora", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [35,85], afternoon: [30,85], evening: [10,55] }},
    { id: "kali", name: "Kali River Rapids", parkArea: "Asia", onRideTime: 4, weatherEffect: 1, waitTimes: { morning: [5,50], afternoon: [5,40], evening: [10,45] }},
    { id: "everest", name: "Expedition Everest", parkArea: "Asia", onRideTime: 3, weatherEffect: 1, waitTimes: { morning: [10,50], afternoon: [10,35], evening: [5,90] }},
  ],
},
};
