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
      { id: "pirates", name: "Pirates of the Caribbean", parkArea: "Adventureland", onRideTime: 9, weatherEffect: 0, waitTimes: { morning: [10,30], afternoon: [25,45], evening: [20,40] }},
      { id: "haunted", name: "Haunted Mansion", parkArea: "Liberty Square", onRideTime: 8, weatherEffect: 0, waitTimes: { morning: [15,30], afternoon: [30,50], evening: [25,45] }},
      { id: "space", name: "Space Mountain", parkArea: "Tomorrowland", onRideTime: 3, weatherEffect: 0, waitTimes: { morning: [20,40], afternoon: [35,60], evening: [30,50] }},
      { id: "smallworld", name: "it's a small world", parkArea: "Fantasyland", onRideTime: 11, weatherEffect: 0, waitTimes: { morning: [5,15], afternoon: [15,25], evening: [10,20] }},
      { id: "cruise", name: "Jungle Cruise", parkArea: "Adventureland", onRideTime: 9, weatherEffect: 1, waitTimes: { morning: [20,40], afternoon: [40,65], evening: [30,55] }},
      { id: "speedway", name: "Tomorrowland Speedway", parkArea: "Tomorrowland", onRideTime: 5, weatherEffect: 1, waitTimes: { morning: [10,25], afternoon: [25,45], evening: [20,35] }},
      { id: "peterpan", name: "Peter Pan's Flight", parkArea: "Fantasyland", onRideTime: 3, weatherEffect: 0, waitTimes: { morning: [25,45], afternoon: [45,70], evening: [35,60] }},
      { id: "carrousel", name: "Prince Charming Regal Carrousel", parkArea: "Fantasyland", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [5,10], afternoon: [10,20], evening: [5,15] }},
      { id: "teacups", name: "Mad Tea Party", parkArea: "Fantasyland", onRideTime: 2, weatherEffect: 0, waitTimes: { morning: [5,10], afternoon: [10,20], evening: [10,15] }},
      { id: "dumbo", name: "Dumbo the Flying Elephant", parkArea: "Fantasyland", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [10,20], afternoon: [15,30], evening: [10,25] }},
      { id: "progress", name: "Walt Disney's Carousel of Progress", parkArea: "Tomorrowland", onRideTime: 21, weatherEffect: 0, waitTimes: { morning: [5,10], afternoon: [5,15], evening: [5,10] }},
      { id: "peoplemover", name: "Tomorrowland Transit Authority PeopleMover", parkArea: "Tomorrowland", onRideTime: 10, weatherEffect: 0, waitTimes: { morning: [5,15], afternoon: [10,25], evening: [10,20] }},
      { id: "thunder", name: "Big Thunder Mountain Railroad", parkArea: "Frontierland", onRideTime: 4, weatherEffect: 1, waitTimes: { morning: [15,30], afternoon: [30,55], evening: [25,45] }},
      { id: "orbiter", name: "Astro Orbiter", parkArea: "Tomorrowland", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [10,20], afternoon: [20,35], evening: [15,30] }},
      { id: "barnstormer", name: "The Barnstormer", parkArea: "Fantasyland", onRideTime: 1, weatherEffect: 1, waitTimes: { morning: [5,15], afternoon: [15,30], evening: [10,25] }},
      { id: "buzz", name: "Buzz Lightyear's Space Ranger Spin", parkArea: "Tomorrowland", onRideTime: 4, weatherEffect: 0, waitTimes: { morning: [10,25], afternoon: [25,45], evening: [20,35] }},
      { id: "pooh", name: "The Many Adventures of Winnie the Pooh", parkArea: "Fantasyland", onRideTime: 3, weatherEffect: 0, waitTimes: { morning: [10,25], afternoon: [25,45], evening: [20,40] }},
      { id: "aladdin", name: "The Magic Carpets of Aladdin", parkArea: "Adventureland", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [5,15], afternoon: [10,25], evening: [10,20] }},
      { id: "tron", name: "TRON Lightcycle Run", parkArea: "Tomorrowland", onRideTime: 1, weatherEffect: 0, waitTimes: { morning: [40,70], afternoon: [60,90], evening: [50,80] }},
      { id: "ariel", name: "Under the Sea Journey of The Little Mermaid", parkArea: "Fantasyland", onRideTime: 6, weatherEffect: 0, waitTimes: { morning: [5,15], afternoon: [15,30], evening: [10,25] }},
      { id: "sdmt", name: "Seven Dwarfs Mine Train", parkArea: "Fantasyland", onRideTime: 3, weatherEffect: 1, waitTimes: { morning: [35,60], afternoon: [55,85], evening: [45,75] }},
      { id: "tianas", name: "Tiana's Bayou Adventure", parkArea: "Frontierland", onRideTime: 11, weatherEffect: 1, waitTimes: { morning: [40,70], afternoon: [60,95], evening: [50,80] }},
    ],
  },
  EPCOT: {
    rides: [
      { id: "soarin", name: "Soarin'", parkArea: "World Nature", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [20,35], afternoon: [35,55], evening: [30,45] }},
      { id: "testtrack", name: "Test Track", parkArea: "World Discovery", onRideTime: 4, weatherEffect: 1, waitTimes: { morning: [35,60], afternoon: [55,85], evening: [45,75] }},
      { id: "frozen", name: "Frozen Ever After", parkArea: "World Showcase", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [30,50], afternoon: [50,75], evening: [40,65] }},
      { id: "spaceship", name: "Spaceship Earth", parkArea: "World Celebration", onRideTime: 15, weatherEffect: 0, waitTimes: { morning: [5,15], afternoon: [15,30], evening: [10,25] }},
      { id: "goat", name: "Living with the Land", parkArea: "World Nature", onRideTime: 14, weatherEffect: 0, waitTimes: { morning: [5,15], afternoon: [15,30], evening: [10,20] }},
      { id: "remys", name: "Remy's Ratatouille Adventure", parkArea: "World Showcase", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [25,45], afternoon: [40,65], evening: [35,55] }},
      { id: "guardians", name: "Guardians of the Galaxy: Cosmic Rewind", parkArea: "World Discovery", onRideTime: 3, weatherEffect: 0, waitTimes: { morning: [35,60], afternoon: [55,85], evening: [45,70] }},
      { id: "figment", name: "Journey Into Imagination With Figment", parkArea: "World Nature", onRideTime: 11, weatherEffect: 0, waitTimes: { morning: [5,15], afternoon: [10,25], evening: [10,20] }},
      { id: "mission", name: "Mission: SPACE", parkArea: "World Discovery", onRideTime: 6, weatherEffect: 0, waitTimes: { morning: [10,20], afternoon: [20,35], evening: [15,25] }},
      { id: "nemo", name: "The Seas with Nemo & Friends", parkArea: "World Nature", onRideTime: 6, weatherEffect: 0, waitTimes: { morning: [5,10], afternoon: [10,20], evening: [5,15] }},
      { id: "fiesta", name: "Gran Fiesta Tour Starring The Three Caballeros", parkArea: "World Showcase", onRideTime: 8, weatherEffect: 0, waitTimes: { morning: [5,10], afternoon: [5,15], evening: [5,15] }},
    ],
  },
  "Hollywood Studios": {
    rides: [
      { id: "rise", name: "Rise of the Resistance", parkArea: "Galaxy's Edge", onRideTime: 18, weatherEffect: 0, waitTimes: { morning: [45,75], afternoon: [65,105], evening: [55,90] }},
      { id: "slinky", name: "Slinky Dog Dash", parkArea: "Toy Story Land", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [45,70], afternoon: [60,90], evening: [50,80] }},
      { id: "aliens", name: "Alien Swirling Saucers", parkArea: "Toy Story Land", onRideTime: 2, weatherEffect: 0, waitTimes: { morning: [10,25], afternoon: [25,40], evening: [20,35] }},
      { id: "smugglers", name: "Smuggler's Run", parkArea: "Galaxy's Edge", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [20,35], afternoon: [35,55], evening: [30,45] }},
      { id: "startours", name: "Star Tours", parkArea: "Echo Lake", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [10,25], afternoon: [25,40], evening: [20,35] }},
      { id: "tower", name: "The Twilight Zone Tower of Terror", parkArea: "Sunset Boulevard", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [30,50], afternoon: [45,70], evening: [40,60] }},
      { id: "rock", name: "Rock 'n' Roller Coaster", parkArea: "Sunset Boulevard", onRideTime: 1, weatherEffect: 0, waitTimes: { morning: [30,50], afternoon: [50,75], evening: [40,65] }},
      { id: "railway", name: "Mickey & Minnie's Runaway Railway", parkArea: "Chinese Theater", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [25,45], afternoon: [40,65], evening: [35,55] }},
      { id: "mania", name: "Toy Story Mania", parkArea: "Toy Story Land", onRideTime: 8, weatherEffect: 0, waitTimes: { morning: [25,45], afternoon: [40,60], evening: [30,50] }},
    ],
  },
  "Animal Kingdom": {
    rides: [
      { id: "flight", name: "Flight of Passage", parkArea: "Pandora", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [45,75], afternoon: [60,95], evening: [50,80] }},
      { id: "safari", name: "Kilimanjaro Safaris", parkArea: "Africa", onRideTime: 19, weatherEffect: 1, waitTimes: { morning: [15,35], afternoon: [30,50], evening: [25,45] }},
      { id: "river", name: "Na'vi River Journey", parkArea: "Pandora", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [25,45], afternoon: [40,60], evening: [30,50] }},
      { id: "kali", name: "Kali River Rapids", parkArea: "Asia", onRideTime: 4, weatherEffect: 1, waitTimes: { morning: [15,35], afternoon: [30,55], evening: [25,45] }},
      { id: "everest", name: "Expedition Everest", parkArea: "Asia", onRideTime: 3, weatherEffect: 1, waitTimes: { morning: [20,40], afternoon: [35,60], evening: [30,50] }},
    ],
  },
};
