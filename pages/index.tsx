import Head from 'next/head'
import fs from 'fs/promises'
import parse from 'csv-parse/lib/sync'
import _ from 'lodash'
import { parse as parseDate, format as dateFormat, isPast } from 'date-fns'

interface Game {
	date: string
	who: string
	field: string
	home: string
	away: string
}

interface GameData {
	Date: string
	Time: string
	division_name: string
	field_name: string
	home_team: string
	visit_team: string
}

function cleanDate(date: string) {
	return date.replace('  ', ' ')
}

function cleanTeam(team: string) {
	return team.replace("Susan's", 'Susans')
}

function gameFactory({
	Date: date,
	Time,
	division_name,
	field_name,
	home_team,
	visit_team,
}: GameData): Game {
	const who =
		division_name === 'Division 3'
			? 'Nad'
			: division_name === 'Premier'
			? 'Mo'
			: division_name === '1'
			? 'Kat'
			: '?'
	return {
		date: cleanDate(`${date} ${Time}`),
		who,
		field: field_name,
		home: cleanTeam(home_team),
		away: cleanTeam(visit_team),
	}
}

type GameProps = {
	games: Game[]
}

function Home({ games }: GameProps) {
	return (
		<div className="container">
			<Head>
				<title>Socker Schedules</title>
				<meta
					name="description"
					content="Socker schedules for my friends"
				/>
				<link rel="icon" href="/favicon.ico" />
				<link
					href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.0/dist/css/bootstrap.min.css"
					rel="stylesheet"
					integrity="sha384-KyZXEAg3QhqLMpG8r+8fhAXLRk2vvoC2f3B09zVXn8CA5QIVfZOJ3BCsw2P0p/We"
					crossOrigin="anonymous"
				></link>
				<style>{`td {
					vertical-align: middle;
				}`}</style>
			</Head>

			<h1>Socker Schedules</h1>
			<div className="table-responsive">
				<table className="table">
					<thead>
						<tr>
							<th>Date</th>
							<th>Who</th>
							<th>Field</th>
							<th>Home</th>
							<th>Away</th>
						</tr>
					</thead>
					<tbody>
						{games.map(
							({ date: dateString, who, field, home, away }) => {
								const date = parseDate(
									dateString,
									'yyyy-LL-dd h:mmaa',
									new Date()
								)
								return (
									<tr
										key={`${date}-${who}`}
										className={
											isPast(date)
												? 'table-secondary'
												: ''
										}
									>
										<td>
											<div className="d-none d-lg-block">
												{dateFormat(date, 'eee LLL d')}
											</div>
											<div className="d-lg-none">
												{dateFormat(date, 'eee')}
											</div>
											<div className="d-lg-none">
												{dateFormat(date, 'LLL d')}
											</div>
											<div>
												{dateFormat(date, 'h:mma')}
											</div>
										</td>
										<td>{who}</td>
										<td>{field}</td>
										<td>{home}</td>
										<td>{away}</td>
									</tr>
								)
							}
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}

export async function getStaticProps() {
	const filenames = ['nad', 'mo', 'kat']
	const csvStrings = await Promise.all(
		filenames.map((filename) => {
			return fs.readFile(`data/${filename}.csv`, 'utf8')
		})
	)

	const gameData = csvStrings.reduce<GameData[]>(
		(result, csvString) => [
			...result,
			...parse(csvString, { columns: true }),
		],
		[]
	)

	let games = gameData.map(gameFactory)
	games = _.orderBy(games, 'date')

	return { props: { games } }
}

export default Home
