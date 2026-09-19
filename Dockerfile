FROM maven:3.9-eclipse-temurin-17 AS build

LABEL org.opencontainers.image.title="Tesis"

WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src

RUN mvn clean package -DskipTests

FROM maven:3.9-eclipse-temurin-17

LABEL org.opencontainers.image.title="Tesis"

WORKDIR /app

COPY --from=build /app/target ./target
COPY --from=build /app/pom.xml ./pom.xml

ENV PORT=10000

EXPOSE 10000

CMD ["mvn", "exec:java"]
