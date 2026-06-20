package circuitbreaker

type State string

const (
	StateClosed   State = "CLOSED"
	StateOpen     State = "OPEN"
	StateHalfOpen State = "HALF_OPEN"
)

func (s State) String() string {
	return string(s)
}
