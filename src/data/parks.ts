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
      { id: "pirates", name: "Pirates of the Caribbean", parkArea: "Adventureland", onRideTime: 9, weatherEffect: 0, waitTimes: { morning: [15,40], afternoon: [25,60], evening: [20,50] }},
      { id: "haunted", name: "Haunted Mansion", parkArea: "Liberty Square", onRideTime: 8, weatherEffect: 0, waitTimes: { morning: [20,45], afternoon: [30,65], evening: [25,55] }},
      { id: "space", name: "Space Mountain", parkArea: "Tomorrowland", onRideTime: 3, weatherEffect: 0, waitTimes: { morning: [25,50], afternoon: [40,80], evening: [35,70] }},
      { id: "smallworld", name: "it's a small world", parkArea: "Fantasyland", onRideTime: 11, weatherEffect: 0, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "cruise", name: "Jungle Cruise", parkArea: "Adventureland", onRideTime: 9, weatherEffect: 1, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "speedway", name: "Tomorrowland Speedway", parkArea: "Tomorrowland", onRideTime: 5, weatherEffect: 1, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "peterpan", name: "Peter Pan's Flight", parkArea: "Fantasyland", onRideTime: 3, weatherEffect: 0, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "carrousel", name: "Prince Charming Regal Carrousel", parkArea: "Fantasyland", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "teacups", name: "Mad Tea Party", parkArea: "Fantasyland", onRideTime: 2, weatherEffect: 0, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "dumbo", name: "Dumbo the Flying Elephant", parkArea: "Fantasyland", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "progress", name: "Walt Disney's Carousel of Progress", parkArea: "Tomorrowland", onRideTime: 21, weatherEffect: 0, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "peoplemover", name: "Tomorrowland Transit Authority PeopleMover", parkArea: "Tomorrowland", onRideTime: 10, weatherEffect: 0, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "thunder", name: "Big Thunder Mountain Railroad", parkArea: "Frontierland", onRideTime: 4, weatherEffect: 1, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "orbiter", name: "Astro Orbiter", parkArea: "Tomorrowland", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "barnstormer", name: "The Barnstormer", parkArea: "Fantasyland", onRideTime: 1, weatherEffect: 1, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "buzz", name: "Buzz Lightyear's Space Ranger Spin", parkArea: "Tomorrowland", onRideTime: 4, weatherEffect: 0, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "pooh", name: "The Many Adventures of Winnie the Pooh", parkArea: "Fantasyland", onRideTime: 3, weatherEffect: 0, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "aladdin", name: "The Magic Carpets of Aladdin", parkArea: "Adventureland", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "tron", name: "TRON Lightcycle Run", parkArea: "Tomorrowland", onRideTime: 1, weatherEffect: 0, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "ariel", name: "Under the Sea Journey of The Little Mermaid", parkArea: "Fantasyland", onRideTime: 6, weatherEffect: 0, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "sdmt", name: "Seven Dwarfs Mine Train", parkArea: "Fantasyland", onRideTime: 3, weatherEffect: 1, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "tianas", name: "Tiana's Bayou Adventure", parkArea: "Frontierland", onRideTime: 11, weatherEffect: 1, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
    ],
  },
  EPCOT: {
    rides: [
      { id: "soarin", name: "Soarin'", parkArea: "World Nature", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [20,45], afternoon: [30,70], evening: [25,60] }},
      { id: "testtrack", name: "Test Track", parkArea: "World Discovery", onRideTime: 4, weatherEffect: 1, waitTimes: { morning: [30,60], afternoon: [45,90], evening: [40,80] }},
      { id: "frozen", name: "Frozen Ever After", parkArea: "World Showcase", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [25,55], afternoon: [40,85], evening: [35,75] }},
      { id: "spaceship", name: "Spaceship Earth", parkArea: "World Celebration", onRideTime: 15, weatherEffect: 0, waitTimes: { morning: [25,55], afternoon: [40,80], evening: [35,70] }},
      { id: "goat", name: "Living with the Land", parkArea: "World Nature", onRideTime: 14, weatherEffect: 0, waitTimes: { morning: [25,55], afternoon: [40,80], evening: [35,70] }},
      { id: "remys", name: "Remy's Ratatouille Adventure", parkArea: "World Showcase", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [25,55], afternoon: [40,80], evening: [35,70] }},
      { id: "guardians", name: "Guardians of the Galaxy: Cosmic Rewind", parkArea: "World Discovery", onRideTime: 3, weatherEffect: 0, waitTimes: { morning: [25,55], afternoon: [40,80], evening: [35,70] }},
      { id: "figment", name: "Journey Into Imagination With Figment", parkArea: "World Nature", onRideTime: 11, weatherEffect: 0, waitTimes: { morning: [25,55], afternoon: [40,80], evening: [35,70] }},
      { id: "mission", name: "Mission: SPACE", parkArea: "World Discovery", onRideTime: 6, weatherEffect: 0, waitTimes: { morning: [25,55], afternoon: [40,80], evening: [35,70] }},
      { id: "nemo", name: "The Seas with Nemo & Friends", parkArea: "World Nature", onRideTime: 6, weatherEffect: 0, waitTimes: { morning: [25,55], afternoon: [40,80], evening: [35,70] }},
      { id: "fiesta", name: "Gran Fiesta Tour Starring The Three Caballeros", parkArea: "World Showcase", onRideTime: 8, weatherEffect: 0, waitTimes: { morning: [25,55], afternoon: [40,80], evening: [35,70] }},
    ],
  },
  "Hollywood Studios": {
    rides: [
      { id: "rise", name: "Rise of the Resistance", parkArea: "Galaxy's Edge", onRideTime: 18, weatherEffect: 0, waitTimes: { morning: [30,70], afternoon: [50,120], evening: [45,100] }},
      { id: "slinky", name: "Slinky Dog Dash", parkArea: "Toy Story Land", onRideTime: 2, weatherEffect: 1, waitTimes: { morning: [25,60], afternoon: [40,90], evening: [35,80] }},
      { id: "aliens", name: "Alien Swirling Saucers", parkArea: "Toy Story Land", onRideTime: 2, weatherEffect: 0, waitTimes: { morning: [30,65], afternoon: [45,105], evening: [40,90] }},
      { id: "smugglers", name: "Smuggler's Run", parkArea: "Galaxy's Edge", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [30,65], afternoon: [45,105], evening: [40,90] }},
      { id: "startours", name: "Star Tours", parkArea: "Echo Lake", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [30,65], afternoon: [45,105], evening: [40,90] }},
      { id: "tower", name: "The Twilight Zone Tower of Terror", parkArea: "Sunset Boulevard", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [30,65], afternoon: [45,105], evening: [40,90] }},
      { id: "rock", name: "Rock 'n' Roller Coaster", parkArea: "Sunset Boulevard", onRideTime: 1, weatherEffect: 0, waitTimes: { morning: [30,65], afternoon: [45,105], evening: [40,90] }},
      { id: "railway", name: "Mickey & Minnie's Runaway Railway", parkArea: "Chinese Theater", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [30,65], afternoon: [45,105], evening: [40,90] }},
      { id: "mania", name: "Toy Story Mania", parkArea: "Toy Story Land", onRideTime: 8, weatherEffect: 0, waitTimes: { morning: [30,65], afternoon: [45,105], evening: [40,90] }},
    ],
  },
  "Animal Kingdom": {
    rides: [
      { id: "flight", name: "Flight of Passage", parkArea: "Pandora", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [30,70], afternoon: [45,100], evening: [40,90] }},
      { id: "safari", name: "Kilimanjaro Safaris", parkArea: "Africa", onRideTime: 19, weatherEffect: 1, waitTimes: { morning: [20,50], afternoon: [30,75], evening: [25,65] }},
      { id: "river", name: "Na'vi River Journey", parkArea: "Pandora", onRideTime: 5, weatherEffect: 0, waitTimes: { morning: [25,60], afternoon: [40,90], evening: [35,80] }},
      { id: "kali", name: "Kali River Rapids", parkArea: "Asia", onRideTime: 4, weatherEffect: 1, waitTimes: { morning: [25,60], afternoon: [40,90], evening: [35,80] }},
      { id: "everest", name: "Expedition Everest", parkArea: "Asia", onRideTime: 3, weatherEffect: 1, waitTimes: { morning: [25,60], afternoon: [40,90], evening: [35,80] }},
    ],
  },
};
