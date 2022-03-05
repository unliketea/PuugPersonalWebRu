import React, { useCallback, useState, useRef, useEffect } from "react"
import { graphql } from "gatsby"
import { DateTime, Duration } from 'luxon'
import { Location } from '@reach/router'
import queryString from 'query-string'
import { styled } from "@material-ui/core/styles"
import { Backdrop, Button, Card, Container, Drawer, FormControl, FormHelperText, FormLabel, IconButton, LinearProgress, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@material-ui/core'
import ArrowForwardIcon from '@material-ui/icons/ArrowForward'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import NavigateBeforeIcon from '@material-ui/icons/NavigateBefore'
import NavigateNextIcon from '@material-ui/icons/NavigateNext'
import FullscreenIcon from '@material-ui/icons/Fullscreen'
import FullscreenExitIcon from '@material-ui/icons/FullscreenExit'
import { useTranslation } from "gatsby-plugin-react-i18next"
import { isLoggedIn, getUser } from "../firebase"
import firebase from "gatsby-plugin-firebase"
import SignIn from "../components/SignIn"
import Nav from "../components/Nav"
import Footer from "../components/Footer"
import Pay from "../components/Pay"
import Loads from "../components/Loads"

const slots = [11,15,19,21]

const withLocation = ComponentToWrap => props => (
  <Location>
    {({ location, navigate }) => (
      <ComponentToWrap
        {...props}
        location={location}
        navigate={navigate}
        search={location.search ? queryString.parse(location.search) : {}}
      />
    )}
  </Location>
)

const conflicts = (a,b) => {
  const endOf = (e) => e.date.plus(Duration.fromObject({minutes:e.duration}))
  return a.date < endOf(b) && b.date < endOf(a) ? true : false
}

const createSlots = (d,h) => {
  var sofiaTime = d.plus(Duration.fromObject({hours:d.hour-d.setZone('Europe/Sofia').hour+h}))
  var localTime = sofiaTime.toLocal().plus(Duration.fromObject({days:d.ordinal-sofiaTime.ordinal}))
  return { date: localTime, duration: 120 }
}

const Page = ({ search }) => {
  const { t } = useTranslation("book")
  const today = useRef(DateTime.local().startOf('day'))
  const [sessionType,setSessionType] = useState(search.for || 'individual')
  const [timeslot,setTimeslot] = useState(null)
  const [paymentIntent,setPaymentIntent] = useState(null)
  const [monthIndex,setMonthIndex] = useState(today.current.daysInMonth - today.current.day <= 7-((today.current.weekday-1)%6) ? 1 : 0)
  const [selectedDay,setSelectedDay] = useState(today.current)
  const [focused,setFocused] = useState(false)
  const [events,setEvents] = useState([])
  const [isBooking,setIsBooking] = useState(false)
  const [isPaying,setIsPaying] = useState(false)
  const [isSigningIn,setIsSigningIn] = useState(false)
  const [isSignedIn,setIsSignedIn] = useState(isLoggedIn())
  const [loading,setLoading] = useState(false)
  const [loadingEvents,setLoadingEvents] = useState(false)
  const [error,setError] = useState(null)

  const first = today.current.startOf('month').plus(Duration.fromObject({months:monthIndex}))
  const start = first.minus(Duration.fromObject({days:first.weekday%7}))


  const addBooking = useCallback((booking) => {
    setEvents(e => [...e,booking])
    return true
  },[])
  const clearBookings = useCallback(() => setEvents([]),[])

  const handleSelectDay = (date) => {
    setSelectedDay(date)
    setIsBooking(true)
  }
  const handleCloseBookingDialog = (_) => {
    setIsBooking(false)
    setTimeslot(null)
  }
  const handleChangeDay = (v) => {
    setSelectedDay(selectedDay.plus(Duration.fromObject({days:v})))
    setTimeslot(null);
  }
  const handleBookNow = async (_) => {
    if(!isLoggedIn()) setIsSigningIn(true)
    else {
      if(isSigningIn) setIsSigningIn(false)
      setLoading(true)
      try {
        const response = await firebase.app().functions("europe-central2").httpsCallable('stripePaymentIntent')({sessionType:sessionType})
        setPaymentIntent(response.data)
        setIsPaying(true)
      } catch(err) {
        setError(`${t('errors.general')} ${t('resolvers.refreshRetry')} ${t('resolvers.thenContactToBook')}`)
      } finally {
        setLoading(false)
      }
    }
  }
  const onSuccessPay = doc => {
    setEvents(e => [...e, doc]);
    setIsPaying(false);
    setIsBooking(false);
  }

  useEffect(() => {
    setLoadingEvents(true)
    const first = DateTime.local().startOf('month').plus(Duration.fromObject({months:monthIndex}))
    const start = first.minus(Duration.fromObject({days:first.weekday%7}))
    firebase.firestore().collection("bookings")
        .where('date', '>=', start.toJSDate())
        .where('date', '<', start.plus(Duration.fromObject({days:43})).toJSDate())
      .get().then(snapshot => {    
        clearBookings()
        snapshot.forEach(b => {
          const data = b.data()
          addBooking({
            duration: data.duration,
            paymentReference: data.paymentReference,
            date: DateTime.fromJSDate(data.date.toDate()).toLocal(),
            userEmail: data.userEmail,
            sessionType: data.sessionType,
          })})})
      .finally(() => setLoadingEvents(false))
  },[addBooking,clearBookings,monthIndex])

  useEffect(() => {
    const unregisterAuthObserver = firebase.auth().onAuthStateChanged(user => {
      setIsSignedIn(!!user)
    })
    return () => unregisterAuthObserver();
  }, [])
  
  return (<>
    <Nav />
    <Container maxWidth="md">
      <Stack>
        <FormControl component="fieldset">
          <FormLabel>{t('labels.consultationType')}</FormLabel>
          <ToggleButtonGroup exclusive value={sessionType} onChange={(_,v) => { if(!!v) setSessionType(v) }} css="display:flex; flex-flow:row nowrap">
            <ToggleButton value="individual" color="primary">{t('labels.adult')}</ToggleButton>
            <ToggleButton value="couple" color="primary">{t('labels.couple')}</ToggleButton>
            <ToggleButton value="child" color="primary">{t('labels.child')}</ToggleButton>
          </ToggleButtonGroup>
        </FormControl>
        <FormControl component="fieldset">
          <FormLabel component="legend">{t('labels.selectDate')}</FormLabel>
            <Loads component={Calendar} loading={loadingEvents} elevation={3} style={{position:focused ? "fixed" : "relative"}}>
              <Navigation>
                <IconButton size="medium" variant="contained" onClick={() => {setMonthIndex(monthIndex-1)}}><NavigateBeforeIcon /></IconButton>
                <Label>{t('date',{val:first.toJSDate(),formatParams:{val:{month:'long'}}})}</Label>
                <IconButton size="medium" variant="contained" onClick={() => {setMonthIndex(monthIndex+1)}}><NavigateNextIcon /></IconButton>
                {focused && <IconButton size="medium" variant="contained" onClick={() => setFocused(false)}><FullscreenExitIcon /></IconButton>}
                {!focused && <IconButton size="medium" variant="contained" onClick={() => setFocused(true)}><FullscreenIcon /></IconButton>}
              </Navigation>
              <MonthLayout elevation={0}>
                <DayLabels>{[
                  t('date',{val:start,formatParams:{val:{weekday:'narrow'}}}),
                  t('date',{val:start.plus({days:1}),formatParams:{val:{weekday:'narrow'}}}),
                  t('date',{val:start.plus({days:2}),formatParams:{val:{weekday:'narrow'}}}),
                  t('date',{val:start.plus({days:3}),formatParams:{val:{weekday:'narrow'}}}),
                  t('date',{val:start.plus({days:4}),formatParams:{val:{weekday:'narrow'}}}),
                  t('date',{val:start.plus({days:5}),formatParams:{val:{weekday:'narrow'}}}),
                  t('date',{val:start.plus({days:6}),formatParams:{val:{weekday:'narrow'}}})].map((day,i) => <MonthColLabel key={i}>{day}</MonthColLabel>)}</DayLabels>
                {Array.from({length:6},(_,k)=>(k)).map(week => {
                  return <Week key={week}>
                    {Array.from({length:7},(_,k)=>(k)).map(day => {
                      const date = first.minus(Duration.fromObject({days:first.weekday%7})).plus(Duration.fromObject({days:(week)*7+day}))
                      return (<Day key={day} date={date} handleSelect={handleSelectDay} selectable={date > today.current} isSignedIn={isSignedIn}
                        events={events.filter(e => e.date.ordinal === date.ordinal)} />)
                    })}
                  </Week>
                })}
              </MonthLayout>
            </Loads>
        </FormControl>
      </Stack>
    </Container>

    <SignIn open={isSigningIn} onClose={() => setIsSigningIn(false)} onSuccess={handleBookNow} />
    <Pay open={isPaying} intent={paymentIntent} booking={{
      date: timeslot,
      duration: sessionType === "couple" ? 90 : 60,
      sessionType: sessionType,
      userEmail: getUser().email,
    }} onClose={() => setIsPaying(false)} onSuccess={onSuccessPay} />

    <Loads component={Drawer} loading={loading} open={isBooking} onClose={handleCloseBookingDialog} anchor="top">
      <Container maxWidth="xs" css="margin:1em auto; text-align:center">
        <div css='position:relative; button { position:absolute; left:0; top:50%; margin-top:-1.5rem; &:last-child { right:0; left:unset; }}'>
          <IconButton size="medium" aria-label="previous" onClick={() => handleChangeDay(-1)}><ArrowBackIcon /></IconButton>
          <Typography gutterBottom variant="h5">{t('date',{val:selectedDay.toJSDate(),formatParams:{val:{day:"numeric",month:"long",year:"numeric"}}})}</Typography>
          <IconButton size="medium" variant="outlined" aria-label="next" onClick={() => handleChangeDay(1)}><ArrowForwardIcon /></IconButton>
        </div>
        <FormControl component="fieldset" css="margin-bottom:1rem">
          <FormLabel>{t('labels.selectTime')}</FormLabel>
          <ToggleButtonGroup exclusive value={timeslot} onChange={(_,v) => setTimeslot(v)} orientation="vertical" color="primary">
            {Array.from({length:4},(_,k)=>createSlots(selectedDay,slots[k])).sort((a,b)=>a.date.hour-b.date.hour)
              .map((s,i) => {
                const evts = events.filter(event => event.date.ordinal===selectedDay.ordinal)
                return <Slot key={i} css={{border:"1px solid grey"}} timeslot={s.date} selected={!!timeslot && conflicts(s,{date: timeslot, duration:120})}
                  status={evts.some(e => conflicts(e,s))?evts.some(e => isSignedIn && conflicts(e,s) && getUser().email===e.userEmail)?"mine":"booked":"free"}
                  disabled={evts.some(e => e.date<=today.current || conflicts(e,s))}
                  duration={sessionType==="couple"?90:60} />
            })}
          </ToggleButtonGroup>
        </FormControl>
        <Typography variant="h5" color="secondary">{sessionType === "individual" ? 60 : sessionType === 'couple' ? 75 : 40} лв</Typography>
        <Button variant="outlined" color="primary" disabled={!timeslot || loading} onClick={handleBookNow}>{t('buttons.bookNow')}</Button>
        {!!error && <FormHelperText error={true}>
            <span>{error}</span>
          </FormHelperText>
        }
      </Container>
      {loading && <LinearProgress />}
      <Backdrop invisible open={loading} />
    </Loads>
    <Footer />
  </>)
}

const _Day = (props) => {
  const { date, selectable, selected, handleSelect, events, children, isSignedIn, ...rest } = props
  const state = useRef({ x: 0 });
  const handleMouseDown = e => state.current.x = e.screenX
  const handleClick = e => {
      if (Math.abs(e.screenX - state.current.x) < 10 && selectable && handleSelect) handleSelect(date)
      else e.preventDefault();
  };
  return (
    <Card {...rest} variant="outlined" onClick={handleClick} onMouseDown={handleMouseDown} css="display:flex; flex-flow:row wrap;">
      <DayLabel>{date.day}</DayLabel>
      {Array.from({length:4},(_,k)=>createSlots(date,slots[k])).sort((a,b)=>a.date.hour-b.date.hour)
        .map((s,i) => <MonthSlot key={i} timeslot={s.date} disabled={true} selected={selected}
          status={events.some(e => conflicts(e,s))?events.some(e => isSignedIn && conflicts(e,s) && getUser().email===e.userEmail)?"mine":"booked":"free"} />)}
    </Card>
  )
}

const _Slot = (props) => {
  const { t } = useTranslation('book')
  const { timeslot, duration, status, ...rest } = props
  return (<ToggleButton css="padding:0" value={timeslot} {...rest}>
    {duration && t('date',{val:timeslot.toJSDate(),formatParams:{val:{ hour:'2-digit', minute:'2-digit'}}})}&nbsp;
  </ToggleButton>)
}

const Slot = styled(_Slot)`
  background-color:${props => props.status==="mine"?props.theme.palette.mySlot.main:props.status==="booked"?props.theme.palette.bookedSlot.main:props.theme.palette.freeSlot.main};
  &:hover{
    background-color:${props => props.status==="mine"?props.theme.palette.mySlot.main:props.status==="booked"?props.theme.palette.bookedSlot.main:props.theme.palette.freeSlot.main};
  }
  &[selected] {
    background-color:${props => props.theme.palette.mySlot.main};
  }
`

const Calendar = styled(Paper)`
  top:0;
  left:0;
  height:100%;
  width:100%;
  transition-delay:1s;

  padding:0px;
  text-align:center;
  display:flex;
  flex-direction:column;
`

const Navigation = styled(Container)`
  display:flex;
  flex-direction:row;
  align-items:center;
  flex:0 0;
  margin:0 1em;
`

const Label = styled(Typography)`
  text-align:center;
  flex:1 1;
`

const MonthLayout = styled(Container)`
  flex:1 0;
  display:flex;
  flex-direction:column;
  padding:0px;
`

const Week = styled(Container)`
  display:flex;
  flex-direction:row;
  flex:1 0;
  padding:0px;
`

const DayLabels = styled(Container)`
  display:flex;
  flex-direction:row;
  flex:0 0 16px;
  padding:0px;
`

const MonthColLabel = styled(Container)`
  text-align:center;
  padding:.5em;
  box-sizing:border-box;
  flex:0 0 13.785%;
  margin:.25%;
  padding:0px;
  border-right:1px solid lightgrey;
  &:last-child {
    border-right:none;
  }
`

const Day = styled(_Day)`
  text-align:center;
  box-sizing:border-box;
  flex:0 0 13.785%;
  margin:.25%;
  opacity:${props => props.selectable?1:props.theme.palette.action.disabledOpacity};
`

const DayLabel = styled(Container)`
  width:100%;
  box-sizing:border-box;
  border-bottom:1px solid white;
`

const MonthSlot = styled(Slot)`
  width:50%;
`

export default withLocation(Page)

export const query = graphql`
  query ($language: String!) {
    locales: allLocale(filter: {language: {eq: $language}}) {
      edges {
        node {
          ns
          data
          language
        }
      }
    }
  }
`;