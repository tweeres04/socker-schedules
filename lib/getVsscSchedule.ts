import fetch from 'node-fetch'
import { JSDOM } from 'jsdom'
import { Game } from './getSchedules'

export async function getVsscSchedule(url: string, teamName: string) {
	const html = await fetch(url).then((response) => response.text())

	const dom = new JSDOM(html)
	const document = dom.window.document

	const dateElements = document.querySelectorAll('.gameDate')

	const games: Game[] = Array.from(dateElements).flatMap((dateElement) => {
		const date = (dateElement as HTMLElement).dataset.date
		const gameRows = dateElement.querySelectorAll('.scheduleTable tbody tr')

		return Array.from(gameRows).flatMap((gameRow) => {
			const time =
				gameRow
					.querySelector('.gameTime')
					?.textContent?.trim()
					.replace(/(\d{1,2}:\d{1,2}) (AM|PM)/, '$1$2') || ''
			const gameCells = Array.from(gameRow.querySelectorAll('td')).slice(
				1
			)
			return gameCells
				.flatMap((gameCell, i) => {
					const teams = gameCell.querySelectorAll('a')
					const teamOne = teams[0]?.textContent?.trim() || ''
					const teamTwo = teams[1]?.textContent?.trim() || ''

					const field = dateElement
						.querySelectorAll('th')
						[i + 1].textContent?.trim()
						?.replace(/[\t\n]+/, ' ')

					if (!field) {
						throw 'Field not found'
					}

					const game: Game = {
						date: `${date} ${time}`,
						who: teamName,
						field,
						home: teamOne,
						away: teamTwo,
					}
					return game
				})
				.filter((game) => {
					return (
						game.home.includes(teamName) ||
						game.away.includes(teamName)
					)
				})
		})
	})

	return games
}
