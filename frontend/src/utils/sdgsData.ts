export interface SDG {
  id: number
  name: string
  englishName: string
  color: string
  description: string
}

export const SDGS_LIST: SDG[] = [
  {
    id: 1,
    name: "Tanpa Kemiskinan",
    englishName: "No Poverty",
    color: "#E5243B",
    description: "Mengakhiri kemiskinan dalam segala bentuk di mana pun."
  },
  {
    id: 2,
    name: "Tanpa Kelaparan",
    englishName: "Zero Hunger",
    color: "#DDA63A",
    description: "Mengakhiri kelaparan, mencapai ketahanan pangan dan nutrisi yang lebih baik, serta mendukung pertanian berkelanjutan."
  },
  {
    id: 3,
    name: "Kehidupan Sehat dan Sejahtera",
    englishName: "Good Health and Well-being",
    color: "#4C9F38",
    description: "Menjamin kehidupan yang sehat dan meningkatkan kesejahteraan seluruh penduduk semua usia."
  },
  {
    id: 4,
    name: "Pendidikan Berkualitas",
    englishName: "Quality Education",
    color: "#C5192D",
    description: "Menjamin kualitas pendidikan yang inklusif dan merata serta meningkatkan kesempatan belajar sepanjang hayat bagi semua."
  },
  {
    id: 5,
    name: "Kesetaraan Gender",
    englishName: "Gender Equality",
    color: "#FF3A21",
    description: "Mencapai kesetaraan gender dan memberdayakan semua perempuan dan anak perempuan."
  },
  {
    id: 6,
    name: "Air Bersih dan Sanitasi Layak",
    englishName: "Clean Water and Sanitation",
    color: "#26BDE2",
    description: "Menjamin ketersediaan dan pengelolaan air bersih serta sanitasi yang berkelanjutan untuk semua."
  },
  {
    id: 7,
    name: "Energi Bersih dan Terjangkau",
    englishName: "Affordable and Clean Energy",
    color: "#FCC30B",
    description: "Menjamin akses terhadap energi yang terjangkau, andal, berkelanjutan, dan modern bagi semua."
  },
  {
    id: 8,
    name: "Pekerjaan Layak dan Pertumbuhan Ekonomi",
    englishName: "Decent Work and Economic Growth",
    color: "#A21942",
    description: "Meningkatkan pertumbuhan ekonomi yang inklusif dan berkelanjutan, kesempatan kerja yang produktif dan menyeluruh, serta pekerjaan yang layak untuk semua."
  },
  {
    id: 9,
    name: "Industri, Inovasi, dan Infrastruktur",
    englishName: "Industry, Innovation, and Infrastructure",
    color: "#FD6925",
    description: "Membangun infrastruktur yang tangguh, mendukung industrialisasi yang inklusif dan berkelanjutan, serta membantu perkembangan inovasi."
  },
  {
    id: 10,
    name: "Berkurangnya Kesenjangan",
    englishName: "Reduced Inequality",
    color: "#DD1367",
    description: "Mengurangi kesenjangan di dalam dan antarnegara."
  },
  {
    id: 11,
    name: "Kota dan Pemukiman yang Berkelanjutan",
    englishName: "Sustainable Cities and Communities",
    color: "#FD9D24",
    description: "Menjadikan kota dan pemukiman inklusif, aman, tangguh, dan berkelanjutan."
  },
  {
    id: 12,
    name: "Konsumsi dan Produksi yang Bertanggung Jawab",
    englishName: "Responsible Consumption and Production",
    color: "#BF8B2E",
    description: "Menjamin pola konsumsi dan produksi yang berkelanjutan."
  },
  {
    id: 13,
    name: "Penanganan Perubahan Iklim",
    englishName: "Climate Action",
    color: "#3F7E44",
    description: "Mengambil tindakan cepat untuk mengatasi perubahan iklim dan dampaknya."
  },
  {
    id: 14,
    name: "Ekosistem Lautan",
    englishName: "Life Below Water",
    color: "#0A97D9",
    description: "Melestarikan dan memanfaatkan secara berkelanjutan sumber daya kelautan dan samudra untuk pembangunan berkelanjutan."
  },
  {
    id: 15,
    name: "Ekosistem Daratan",
    englishName: "Life on Land",
    color: "#56C02B",
    description: "Melindungi, merestorasi, dan meningkatkan pemanfaatan berkelanjutan ekosistem daratan."
  },
  {
    id: 16,
    name: "Perdamaian, Keadilan, dan Kelembagaan yang Tangguh",
    englishName: "Peace, Justice, and Strong Institutions",
    color: "#00689D",
    description: "Mendukung masyarakat yang damai dan inklusif untuk pembangunan berkelanjutan, menyediakan akses terhadap keadilan bagi semua, dan membangun lembaga-lembaga yang efektif, akuntabel, dan inklusif di semua tingkatan."
  },
  {
    id: 17,
    name: "Kemitraan untuk Mencapai Tujuan",
    englishName: "Partnerships for the Goals",
    color: "#19486A",
    description: "Menguatkan sarana implementasi dan merevitalisasi kemitraan global untuk pembangunan berkelanjutan."
  }
]

export function getSDGById(id: number): SDG | undefined {
  return SDGS_LIST.find(s => s.id === id)
}
