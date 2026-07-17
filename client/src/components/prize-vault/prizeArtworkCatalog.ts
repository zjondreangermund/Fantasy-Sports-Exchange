type ArtworkRule = { pattern: RegExp; src: string };

const ARTWORK_VERSION = "2026-07-17";

export const prizeArtworkCatalog: Record<string, ArtworkRule[]> = {
  rare: [
    { pattern: /^N\$500\s+Airtime\s*\/\s*Data$/i, src: "/prizes/rare/rare-01-airtime-data.png" },
    { pattern: /^N\$1,?000\s+Shopping\s+Voucher$/i, src: "/prizes/rare/rare-02-shopping-voucher.png" },
    { pattern: /^Gaming\s+Headset\s+Pro$/i, src: "/prizes/rare/rare-03-gaming-headset-pro.png" },
    { pattern: /^Premium\s+Smart\s*Watch$/i, src: "/prizes/rare/rare-04-premium-smart-watch.png" },
    { pattern: /^JBL\s+Speaker$/i, src: "/prizes/rare/rare-05-jbl-speaker.png" },
    { pattern: /^PS5\s+Game\s+Bundle$/i, src: "/prizes/rare/rare-06-ps5-game-bundle.png" },
    { pattern: /^Premium\s+Coffee\s+Machine$/i, src: "/prizes/rare/rare-07-premium-coffee-machine.png" },
    { pattern: /^Tablet$/i, src: "/prizes/rare/rare-08-tablet.png" },
    { pattern: /^Gaming\s+Monitor$/i, src: "/prizes/rare/rare-09-gaming-monitor.png" },
    { pattern: /^Gaming\s+Chair$/i, src: "/prizes/rare/rare-10-gaming-chair.png" },
    { pattern: /^Home\s+Soundbar$/i, src: "/prizes/rare/rare-11-home-soundbar.png" },
    { pattern: /^55[-\s]?inch\s+Smart\s+TV$/i, src: "/prizes/rare/rare-12-55-inch-smart-tv.png" },
    { pattern: /^Weekend\s+Getaway\s+for\s+Two$/i, src: "/prizes/rare/rare-13-weekend-getaway-for-two.png" },
    { pattern: /^VR\s+Headset$/i, src: "/prizes/rare/rare-14-vr-headset.png" },
    { pattern: /^PlayStation\s+5\s+Console$/i, src: "/prizes/rare/rare-15-playstation-5-console.png" },
    { pattern: /^Xbox\s+Series\s+X$/i, src: "/prizes/rare/rare-16-xbox-series-x.png" },
    { pattern: /^DJI\s+Mini\s+Drone(?:\s*\/\s*Equivalent)?$/i, src: "/prizes/rare/rare-17-dji-mini-drone.png" },
    { pattern: /^Gaming\s+Laptop$/i, src: "/prizes/rare/rare-18-gaming-laptop.png" },
    { pattern: /^Mountain\s+Bike$/i, src: "/prizes/rare/rare-19-mountain-bike.png" },
    { pattern: /^Gaming\s+PC$/i, src: "/prizes/rare/rare-20-gaming-pc.png" },
  ],
  unique: [
    { pattern: /^N\$1,?000\s+Premium\s+Voucher$/i, src: "/prizes/unique/unique-01-premium-voucher.png" },
    { pattern: /^N\$2,?500\s+Gadget\s+Voucher$/i, src: "/prizes/unique/unique-02-gadget-voucher.png" },
    { pattern: /^N\$5,?000\s+Tech\s+Voucher$/i, src: "/prizes/unique/unique-03-tech-voucher.png" },
    { pattern: /^Weekend\s+Away\s+Voucher$/i, src: "/prizes/unique/unique-04-weekend-away-voucher.png" },
    { pattern: /^Mini\s+DJI\s+Drone(?:\s*\/\s*Equivalent)?$/i, src: "/prizes/unique/unique-05-mini-dji-drone.png" },
    { pattern: /^PS5\s+Pro\s*\/\s*Equivalent\s+Console$/i, src: "/prizes/unique/unique-06-ps5-pro-console.png" },
    { pattern: /^Luxury\s+Weekend\s+for\s+Two$/i, src: "/prizes/unique/unique-07-luxury-weekend-for-two.png" },
    { pattern: /^iPhone\s+Pro\s*\/\s*Equivalent$/i, src: "/prizes/unique/unique-08-iphone-pro.png" },
    { pattern: /^MacBook\s+Air$/i, src: "/prizes/unique/unique-09-macbook-air.png" },
    { pattern: /^Samsung\s+Galaxy\s+Ultra$/i, src: "/prizes/unique/unique-10-samsung-galaxy-ultra.png" },
    { pattern: /^Home\s+Theatre\s+Package$/i, src: "/prizes/unique/unique-11-home-theatre-package.png" },
    { pattern: /^Premium\s+Gaming\s+PC$/i, src: "/prizes/unique/unique-12-premium-gaming-pc.png" },
    { pattern: /^N\$35,?000\s+Home\s+Furniture\s+Package$/i, src: "/prizes/unique/unique-13-home-furniture-package.png" },
    { pattern: /^Quad\s+Bike$/i, src: "/prizes/unique/unique-14-quad-bike.png" },
    { pattern: /^N\$50,?000\s+Travel\s+Voucher$/i, src: "/prizes/unique/unique-15-travel-voucher.png" },
    { pattern: /^Jet\s+Ski\s+Experience\s+Package$/i, src: "/prizes/unique/unique-16-jet-ski-experience.png" },
    { pattern: /^Motorcycle$/i, src: "/prizes/unique/unique-17-motorcycle.png" },
    { pattern: /^N\$75,?000\s+Cash\s*\/\s*Equivalent$/i, src: "/prizes/unique/unique-18-cash-75000.png" },
  ],
  epic: [
    { pattern: /^N\$5,?000\s+Cash$/i, src: "/prizes/epic/epic-01-cash-5000.png" },
    { pattern: /^N\$10,?000\s+Cash$/i, src: "/prizes/epic/epic-02-cash-10000.png" },
    { pattern: /^Premium\s+Gaming\s+Laptop$/i, src: "/prizes/epic/epic-03-premium-gaming-laptop.png" },
    { pattern: /^MacBook\s+Pro$/i, src: "/prizes/epic/epic-04-macbook-pro.png" },
    { pattern: /^RTX\s+Gaming\s+PC$/i, src: "/prizes/epic/epic-05-rtx-gaming-pc.png" },
    { pattern: /^Premium\s+Hunting\s+Trip\s+for\s+4$/i, src: "/prizes/epic/epic-06-hunting-trip-for-four.png" },
    { pattern: /^Luxury\s+Europe\s+Holiday\s+for\s+Two$/i, src: "/prizes/epic/epic-07-europe-holiday-for-two.png" },
    { pattern: /^Luxury\s+Home\s+Furniture\s+Package$/i, src: "/prizes/epic/epic-08-home-furniture-package.png" },
    { pattern: /^KTM\s*\/\s*Yamaha\s+Motorcycle$/i, src: "/prizes/epic/epic-09-ktm-yamaha-motorcycle.png" },
    { pattern: /^Quad\s+Bike$/i, src: "/prizes/epic/epic-10-quad-bike.png" },
    { pattern: /^N\$250,?000\s+Cash$/i, src: "/prizes/epic/epic-11-cash-250000.png" },
    { pattern: /^Luxury\s+Maldives\s+Holiday\s+for\s+Two$/i, src: "/prizes/epic/epic-12-maldives-holiday-for-two.png" },
    { pattern: /^N\$300,?000\s+Home\s+Upgrade\s+Package$/i, src: "/prizes/epic/epic-13-home-upgrade-package.png" },
    { pattern: /^Luxury\s+Family\s+Holiday\s*\(Mauritius,\s*Dubai\s+or\s+Bali\)$/i, src: "/prizes/epic/epic-14-family-holiday.png" },
    { pattern: /^Conqueror\s+Off-Road\s+Camping\s+Trailer$/i, src: "/prizes/epic/epic-15-conqueror-camping-trailer.png" },
    { pattern: /^N\$500,?000\s+Cash$/i, src: "/prizes/epic/epic-16-cash-500000.png" },
    { pattern: /^Volkswagen\s+Golf\s+7\s+GTI\s*\/\s*Equivalent$/i, src: "/prizes/epic/epic-17-volkswagen-golf-7-gti.png" },
    { pattern: /^Ford\s+Everest\s*\/\s*Equivalent$/i, src: "/prizes/epic/epic-18-ford-everest.png" },
    { pattern: /^Toyota\s+Fortuner\s*\/\s*Equivalent$/i, src: "/prizes/epic/epic-19-toyota-fortuner.png" },
    { pattern: /^Toyota\s+Hilux\s+GR\s+Sport\s+4[×x]4\s+Double\s+Cab\s*\/\s*Equivalent$/i, src: "/prizes/epic/epic-20-toyota-hilux-gr-sport.png" },
  ],
};

export function artworkForPrize(title: string, rarity: string) {
  const rules = prizeArtworkCatalog[String(rarity || "").toLowerCase()] || [];
  const src = rules.find((item) => item.pattern.test(String(title || "").trim()))?.src;
  return src ? `${src}?v=${ARTWORK_VERSION}` : null;
}
