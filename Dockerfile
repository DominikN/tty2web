FROM golang:1.22.12

# Install Node.js for frontend build
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

COPY . .

RUN go mod tidy

# Build frontend assets and Go binary
RUN make all