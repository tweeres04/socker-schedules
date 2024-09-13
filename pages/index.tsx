import Script from 'next/script'
import { useState, useEffect, useLayoutEffect } from 'react'
import Head from 'next/head'
import { startCase, uniq } from 'lodash'
import {
	parse as parseDate,
	format as dateFormat,
	isPast,
	differenceInHours,
	isToday,
} from 'date-fns'
import { get, set } from 'idb-keyval'
import { Game, getCachedSchedules } from '../lib/getSchedules'
import { utcToZonedTime } from 'date-fns-tz'

const colours = {
	mo: '#51a3a3',
	kat: '#75485e',
	nad: '#cb904d',
	tash: '#132E32',
	owls: '#713f12',
	'green-machine': '#14532d',
}

type GameProps = {
	initialGames: Game[]
	initialFetchDate: string
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
	return uniq(games.map((g) => g.who))
}

function usePeopleFilter(games: Game[]) {
	const migrationKey = '2024-09-13_peopleToShow'
	const keyvalKey = 'peopleToShow'
	const [peopleToShow, setPeopleToShow] = useState<string[]>([])
	const [loading, setLoading] = useState(true)
	const people = peopleFromGames(games)

	useEffect(() => {
		async function getStoredPeople() {
			const migration = await get(migrationKey)
			if (!migration) {
				await set(keyvalKey, [])
				set(migrationKey, new Date().toISOString())
			}
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
					{startCase(p.replace('-', ' '))}
				</label>
				<input
					className="form-check-input"
					id={`${p}_filter`}
					key={p}
					type="checkbox"
					onChange={togglePerson(p)}
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

function useShowPastGamesFilter() {
	const [showPastGames, setShowPastGames] = useState(false)

	function ShowPastGamesFilter() {
		return (
			<div className="form-check form-check-inline">
				<label htmlFor="past_games_filter" className="form-check-label">
					Past games
				</label>
				<input
					className="form-check-input"
					id="past_games_filter"
					type="checkbox"
					onChange={() => setShowPastGames((prevValue) => !prevValue)}
					checked={showPastGames}
				/>
			</div>
		)
	}

	return { showPastGames, ShowPastGamesFilter }
}

function useGames(initialGames: Game[], initialFetchDate: string) {
	let [games, setGames] = useState(initialGames)

	let [fetchDate, setFetchDate] = useState(initialFetchDate)

	useEffect(() => {
		async function fetchUpdatedGames() {
			const hoursSinceFetched = differenceInHours(
				new Date(),
				new Date(initialFetchDate)
			)

			if (hoursSinceFetched > 12) {
				const response = await fetch('/api/games').then((response) =>
					response.json()
				)

				const { games: updatedGames, fetchDate: updatedFetchDate } =
					response
				setGames(updatedGames)
				setFetchDate(updatedFetchDate)
			} else {
				console.log(
					`Skipping downloading schedules, ${hoursSinceFetched} hours since last fetch`
				)
			}
		}

		fetchUpdatedGames()
	}, [initialFetchDate])

	return { games, fetchDate }
}

function Home({ initialGames, initialFetchDate }: GameProps) {
	let { games, fetchDate } = useGames(initialGames, initialFetchDate)
	const shouldMarkPastGames = useShouldMarkPastGames()
	const {
		loading: loadingPeopleToShow,
		PeopleFilter,
		peopleToShow,
	} = usePeopleFilter(games)
	const { showPastGames, ShowPastGamesFilter } = useShowPastGamesFilter()

	const zonedTime = utcToZonedTime(
		new Date(fetchDate as string),
		'America/Vancouver'
	)
	const fetchDateFormatted = new Intl.DateTimeFormat('en-CA', {
		dateStyle: 'full',
		timeStyle: 'short',
	}).format(zonedTime)

	if (peopleToShow.length > 0) {
		games = games.filter((g) => peopleToShow.includes(g.who))
	}

	if (!showPastGames) {
		games = games.filter((g) => {
			const date = parseDate(g.date, 'yyyy-LL-dd h:mmaa', new Date())

			return isToday(date) || !isPast(date)
		})
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
				<meta name="robots" content="noindex"></meta>
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
			{/* Google tag (gtag.js) */}
			{process.env.NODE_ENV === 'production' ? (
				<>
					<Script src="https://www.googletagmanager.com/gtag/js?id=G-WK7Y50LKYS"></Script>
					<Script id="google-analytics">
						{`window.dataLayer = window.dataLayer || [];
						function gtag(){dataLayer.push(arguments);}
						gtag('js', new Date());

						gtag('config', 'G-WK7Y50LKYS');`}
					</Script>
				</>
			) : null}

			<h1 className="mt-1">Socker Schedules</h1>
			<p>
				<small>Last updated: {fetchDateFormatted}</small>
			</p>
			{loadingPeopleToShow ? null : (
				<>
					<div className="py-1 overflow-auto text-nowrap">
						<PeopleFilter />
						<ShowPastGamesFilter />
					</div>
					<div className="table-responsive">
						<table className="table">
							<thead>
								<tr>
									<th>Date</th>
									{peopleToShow.length !== 1 ? (
										<th>Who</th>
									) : null}
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
													isToday(date)
														? 'fw-bold'
														: isPast(date)
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
												{peopleToShow.length !== 1 ? (
													<td>
														{startCase(
															who.replace(
																'-',
																' '
															)
														)}
													</td>
												) : null}
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

export async function getServerSideProps() {
	const { games: initialGames, fetchDate: initialFetchDate } =
		await getCachedSchedules()

	return {
		props: {
			initialGames,
			initialFetchDate: initialFetchDate,
		},
	}
}

export default Home
