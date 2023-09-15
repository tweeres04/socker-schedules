import { useState, useEffect, useLayoutEffect } from 'react'
import Head from 'next/head'
import { parse } from 'csv-parse/sync'
import { orderBy, capitalize, uniq } from 'lodash'
import {
	parse as parseDate,
	format as dateFormat,
	isPast,
	differenceInHours,
} from 'date-fns'
import { utcToZonedTime } from 'date-fns-tz'
import { kv } from '@vercel/kv'
import { get, set } from 'idb-keyval'

import { downloadSchedules } from '../lib/getSchedules.mjs'

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
	who: string
}

const colours = {
	Mo: '#51a3a3',
	Kat: '#75485e',
	Nad: '#cb904d',
	Tash: '#132E32',
	Chris: '#3E442B',
}

function cleanDate(date: string) {
	return date.replace('  ', ' ')
}

function gameFactory({
	Date: date,
	Time,
	field_name,
	home_team,
	visit_team,
	who,
}: GameData): Game {
	return {
		date: cleanDate(`${date} ${Time}`),
		who: capitalize(who),
		field: field_name,
		home: home_team,
		away: visit_team,
	}
}

type GameProps = {
	games: Game[]
	dateFetched: string
}

function useShouldMarkPastGames() {
	const [shouldMarkPastGames, setShouldMarkPastGames] = useState(false)
	useEffect(() => {
		setShouldMarkPastGames(true)
	}, [shouldMarkPastGames])

	useLayoutEffect(() => {
		if (shouldMarkPastGames) {
			const nextGameRow = document.querySelector(
				'tbody tr:not(.table-secondary)'
			)

			nextGameRow?.scrollIntoView({
				behavior: 'auto',
				block: 'nearest',
			})
		}
	}, [shouldMarkPastGames])

	return shouldMarkPastGames
}

function peopleFromGames(games: Game[]) {
	return uniq(games.map((g) => g.who)).map(capitalize)
}

function usePeopleFilter(games: Game[]) {
	const keyvalKey = 'peopleToShow'
	const [peopleToShow, setPeopleToShow] = useState<string[]>([])
	const [loading, setLoading] = useState(true)
	const people = peopleFromGames(games)

	useEffect(() => {
		async function getStoredPeople() {
			const result = await get(keyvalKey)
			if (result) {
				setPeopleToShow(result)
			}
			setLoading(false)
		}

		getStoredPeople()
	}, [])

	function togglePerson(person: string) {
		return function () {
			setPeopleToShow((prevPeopleToShow) => {
				let result
				if (prevPeopleToShow.some((p) => p === person)) {
					result = prevPeopleToShow.filter((p) => p !== person)
				} else {
					result = [...prevPeopleToShow, person]
				}
				set(keyvalKey, result)
				return result
			})
		}
	}

	function PeopleFilter() {
		return people.map((p) => (
			<div className="form-check form-check-inline" key={p}>
				<label htmlFor={`${p}_filter`} className="form-check-label">
					{p}
				</label>
				<input
					className="form-check-input"
					id={`${p}_filter`}
					key={p}
					type="checkbox"
					onClick={togglePerson(p)}
					checked={peopleToShow.some((p_) => p === p_)}
					style={{
						backgroundColor: colours[p as keyof typeof colours],
						borderColor: colours[p as keyof typeof colours],
					}}
				/>
			</div>
		))
	}

	return { loading, peopleToShow, PeopleFilter }
}

function Home({ games, dateFetched }: GameProps) {
	const shouldMarkPastGames = useShouldMarkPastGames()
	const {
		loading: loadingPeopleToShow,
		PeopleFilter,
		peopleToShow,
	} = usePeopleFilter(games)

	if (peopleToShow.length > 0) {
		games = games.filter((g) => peopleToShow.includes(g.who))
	}

	return (
		<div className="container">
			<Head>
				<title>Socker Schedules</title>
				<meta
					name="description"
					content="Socker schedules for my friends"
				/>
				<link rel="icon" href="/soccer-ball.png" />
				<link rel="manifest" href="/manifest.json"></link>
				<link rel="apple-touch-icon" href="/soccer-ball.png"></link>
				<meta
					name="apple-mobile-web-app-status-bar-style"
					content="black"
				></meta>
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

			<h1 className="mt-1">Socker Schedules</h1>
			<p>
				<small>Last updated: {dateFetched}</small>
			</p>
			{loadingPeopleToShow ? null : (
				<>
					<PeopleFilter />
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
									({
										date: dateString,
										who,
										field,
										home,
										away,
									}) => {
										const date = parseDate(
											dateString,
											'yyyy-LL-dd h:mmaa',
											new Date()
										)
										return (
											<tr
												key={`${date}-${who}`}
												className={
													shouldMarkPastGames &&
													isPast(date)
														? 'table-secondary'
														: ''
												}
												style={{
													borderLeft: `5px solid ${
														colours[
															who as keyof typeof colours
														]
													}`,
												}}
											>
												<td>
													<div className="d-none d-lg-block">
														{dateFormat(
															date,
															'eee LLL d'
														)}
													</div>
													<div className="d-lg-none">
														{dateFormat(
															date,
															'eee'
														)}
													</div>
													<div className="d-lg-none">
														{dateFormat(
															date,
															'LLL d'
														)}
													</div>
													<div>
														{dateFormat(
															date,
															'h:mma'
														)}
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
				</>
			)}
		</div>
	)
}

export async function getStaticProps() {
	const dateFetched = await kv.get<string>(`socker-schedules:fetch-date`)

	if (differenceInHours(new Date(), new Date(dateFetched as string)) > 12) {
		await downloadSchedules()
	} else {
		console.log('Skipping downloading schedules')
	}

	const people = ['nad', 'mo', 'kat', 'tash', 'chris']
	const peopleWithCsvString = await Promise.all(
		people.map(async (person) => ({
			who: person,
			csvString: await kv.get<string>(`socker-schedules:${person}`),
		}))
	)

	const gameData = peopleWithCsvString.reduce<GameData[]>(
		(result, { who, csvString }) => [
			...result,
			...parse(csvString as string, { columns: true }).map(
				(gameRow: GameData[]) => ({
					...gameRow,
					who,
				})
			),
		],
		[]
	)

	let games = gameData.map(gameFactory)
	games = orderBy(games, 'date')

	const zonedTime = utcToZonedTime(
		new Date(dateFetched as string),
		'America/Vancouver'
	)
	const dateFetchedFormatted = new Intl.DateTimeFormat('en-CA', {
		dateStyle: 'full',
		timeStyle: 'short',
	}).format(zonedTime)

	return { props: { games, dateFetched: dateFetchedFormatted } }
}

export default Home
