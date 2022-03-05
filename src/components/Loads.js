import React from "react"
import { Backdrop, LinearProgress } from "@material-ui/core"

const Component = (props) => {
  const { loading, component, children, ...rest } = props
  const Inner = component
  return <Inner {...rest}>
    {children}
    {loading && <LinearProgress />}
    <Backdrop invisible open={loading} />
  </Inner>
}

export default Component