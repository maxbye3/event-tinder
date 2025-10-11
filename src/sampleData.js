const addDays = (start, offset) => {
  const date = new Date(start);
  date.setDate(date.getDate() + offset);
  return date;
};

const formatDate = (date) => date.toISOString().slice(0, 10);

const formatTimeRange = (startHour, startMinute, endHour, endMinute) => {
  const toLabel = (hour, minute) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
    const paddedMinute = `${minute}`.padStart(2, '0');
    return `${normalizedHour}:${paddedMinute} ${period}`;
  };

  return `${toLabel(startHour, startMinute)} - ${toLabel(endHour, endMinute)}`;
};

const sampleEvents = [
  {
    title: 'Dupont Circle Farmers Market',
    type: 'outdoors',
    venue: 'Dupont Circle Market',
    address: '1600 20th St NW, Washington, DC 20009',
    offsetDays: 1,
    time: formatTimeRange(8, 30, 13, 30),
    description:
      'Weekly open-air market showcasing regional farmers, artisan makers, and live chef demos in Dupont Circle.',
    url: 'https://www.freshfarm.org/markets/dupont-circle-market',
    image: 'https://images.unsplash.com/photo-1717646472043-8584872755ef?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1470',
  },
  {
    title: 'DC Tech Meetup: AI Startups Showcase',
    type: 'tech',
    venue: 'NYU Brademas Center DC',
    address: '1307 L St NW, Washington, DC 20005',
    offsetDays: 4,
    time: formatTimeRange(18, 30, 20, 30),
    description:
      'Pitch-style evening featuring emerging AI startups from the DMV region plus networking with local founders and investors.',
    url: 'https://www.meetup.com/dc-tech-meetup/events/',
    image: 'https://images.unsplash.com/photo-1671576193244-964fe85e1797?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1932',
  },
  {
    title: 'Kennedy Center Millennium Stage: Free Jazz Night',
    type: 'music',
    venue: 'The John F. Kennedy Center for the Performing Arts',
    address: '2700 F St NW, Washington, DC 20566',
    offsetDays: 6,
    time: formatTimeRange(18, 0, 19, 0),
    description:
      'Free nightly concert on the Millennium Stage featuring a rotating roster of jazz ensembles from across the District.',
    url: 'https://www.kennedy-center.org/whats-on/millennium-stage/',
    image: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1470',
  },
  {
    title: 'Smithsonian American Art: Curator Tour',
    type: 'museum',
    venue: 'Smithsonian American Art Museum',
    address: '8th and G Streets NW, Washington, DC 20004',
    offsetDays: 2,
    time: formatTimeRange(12, 0, 13, 30),
    description: 'Guided curator tour highlighting the newest contemporary art acquisitions.',
    url: 'https://americanart.si.edu/calendar',
    image: 'https://images.unsplash.com/photo-1651439504798-123517bec7b0?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1472',
  },
  {
    title: 'Sunset Yoga on the Wharf',
    type: 'outdoors',
    venue: 'The Wharf Recreation Pier',
    address: '760 Maine Ave SW, Washington, DC 20024',
    offsetDays: 5,
    time: formatTimeRange(19, 0, 20, 0),
    description: 'Open-level vinyasa session along the Potomac with live acoustic music.',
    url: 'https://www.wharfdc.com/upcoming-events/',
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2120',
  },
  {
    title: 'Capital Fringe: Late Night Cabaret',
    type: 'other',
    venue: 'Capital Fringe Headquarters',
    address: '1050 17th St NW, Washington, DC 20036',
    offsetDays: 3,
    time: formatTimeRange(22, 0, 23, 59),
    description: 'Experimental cabaret blending comedy, dance, and improv from local performers.',
    url: 'https://www.capitalfringe.org/',
    image: 'https://images.unsplash.com/photo-1623212305980-d06564d0c8d8?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1470'
  },
  {
    title: 'DC Jazz Jam at Mr. Henry’s',
    type: 'music',
    venue: "Mr. Henry's",
    address: '601 Pennsylvania Ave SE, Washington, DC 20003',
    offsetDays: 0,
    time: formatTimeRange(19, 0, 22, 0),
    description: 'Community jam session featuring rotating house bands and open-mic solos.',
    url: 'https://mrhenrysdc.com/events/',
    image: 'https://images.unsplash.com/photo-1501492765677-f07c5f3d87db?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2076',
  },
  {
    title: 'Capitol Hill Book Fest Author Talk',
    type: 'other',
    venue: 'East City Bookshop',
    address: '645 Pennsylvania Ave SE, Washington, DC 20003',
    offsetDays: 2,
    time: formatTimeRange(18, 0, 19, 0),
    description: 'Author Q&A and signing for the latest release in a beloved historical fiction series.',
    url: 'https://www.eastcitybookshop.com/event',
    image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Rock Creek Conservancy Trail Cleanup',
    type: 'outdoors',
    venue: 'Rock Creek Park Nature Center',
    address: '5200 Glover Rd NW, Washington, DC 20015',
    offsetDays: 7,
    time: formatTimeRange(9, 0, 11, 30),
    description: 'Volunteer trash pickup and invasive plant removal to keep DC trails pristine.',
    url: 'https://www.rockcreekconservancy.org/calendar',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Gallery Y Closing Reception',
    type: 'museum',
    venue: 'Gallery Y (Green Lantern)',
    address: '1335 Green Ct NW, Washington, DC 20005',
    offsetDays: 5,
    time: formatTimeRange(17, 0, 20, 0),
    description: 'Final weekend celebration for a mixed-media collective exploring pop and street art.',
    url: 'https://www.greenlanterndc.com/events',
    image: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Nationals vs. Cubs (Home Game)',
    type: 'sports',
    venue: 'Nationals Park',
    address: '1500 S Capitol St SE, Washington, DC 20003',
    offsetDays: 3,
    time: formatTimeRange(19, 5, 22, 0),
    description: 'Friday night baseball featuring post-game fireworks at the ballpark.',
    url: 'https://www.mlb.com/nationals/tickets',
    image: 'https://images.unsplash.com/photo-1519879709058-11082644047d?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1471',
  },
  {
    title: 'DC Bike Party: Glow Ride',
    type: 'outdoors',
    venue: 'Dupont Circle Fountain',
    address: '1 Dupont Cir NW, Washington, DC 20036',
    offsetDays: 6,
    time: formatTimeRange(20, 0, 22, 0),
    description: 'Nighttime group ride with neon lights, DJ sets, and planned stops at local landmarks.',
    url: 'https://www.dcbikeparty.com/',
    image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Union Market Night Market',
    type: 'other',
    venue: 'Union Market Plaza',
    address: '1309 5th St NE, Washington, DC 20002',
    offsetDays: 1,
    time: formatTimeRange(17, 0, 21, 0),
    description: 'Pop-up vendors, live DJ, and late-night dining specials at Union Market.',
    url: 'https://unionmarketdc.com/events/',
    image: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Politics & Prose: Current Affairs Panel',
    type: 'political',
    venue: 'Politics and Prose at The Wharf',
    address: '70 District Square SW, Washington, DC 20024',
    offsetDays: 5,
    time: formatTimeRange(19, 0, 20, 30),
    description: 'Journalists and policy experts discuss the biggest stories shaping DC this month.',
    url: 'https://www.politics-prose.com/events',
    image: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Anacostia River Guided Kayak',
    type: 'outdoors',
    venue: 'Ballpark Boathouse',
    address: '1500 S Capitol St SE, Washington, DC 20003',
    offsetDays: 2,
    time: formatTimeRange(10, 0, 12, 0),
    description: 'Two-hour kayak tour highlighting the Anacostia River restoration efforts.',
    url: 'https://anacostiaws.org/events',
    image: 'https://images.unsplash.com/photo-1751997145869-21e7f68b5644?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1471',
  },
];

export const createSampleData = () => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);

  const events = sampleEvents.map((event) => {
    const date = addDays(startOfWeek, event.offsetDays ?? 0);
    return {
      ...event,
      date: formatDate(date),
    };
  });

  return {
    events,
    meta: { count: events.length },
  };
};
