import Script from 'next/script'
import { useState, useEffect, useLayoutEffect } from 'react'
import Head from 'next/head'
import { capitalize, uniq } from 'lodash'
import {
	parse as parseDate,
	format as dateFormat,
	isPast,
	differenceInHours,
} from 'date-fns'
import { get, set } from 'idb-keyval'
import { Game, getSchedulesFromDatabase } from '../lib/getSchedules'
import { utcToZonedTime } from 'date-fns-tz'

const colours = {
	Mo: '#51a3a3',
	Kat: '#75485e',
	Nad: '#cb904d',
	Tash: '#132E32',
	Chris: '#3E442B',
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
					<PeopleFilter />
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
												{peopleToShow.length !== 1 ? (
													<td>{who}</td>
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
		await getSchedulesFromDatabase()

	return {
		props: {
			initialGames,
			initialFetchDate: initialFetchDate,
		},
	}
}

export default Home
