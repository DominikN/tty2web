FROM golang:1.22.12

WORKDIR /app

COPY . .

RUN go mod tidy

RUN go build