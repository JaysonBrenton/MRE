const fs = require("fs")
const path = "src/components/organisms/dashboard/DashboardClient.tsx"
const lines = fs.readFileSync(path, "utf8").split("\n")

// Remove DriverCardsAndWeatherGrid + DriverCardData + DriverCard (lines 292-1631, 0-indexed: 291-1630)
const withoutGrid = lines.slice(0, 291).concat(lines.slice(1631))
// Remove WeatherPanel, WeatherStat, WeatherLoadingState, WeatherErrorState (were 1787-2190, now 1787-1340 to 2190-1340 = 447-850)
const withoutWeather = withoutGrid.slice(0, 446).concat(withoutGrid.slice(850))

fs.writeFileSync(path, withoutWeather.join("\n"))
console.log("Removed DriverCardsAndWeatherGrid and weather helpers from DashboardClient")
