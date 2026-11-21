/**
 * TennisScoring
 * Pure arcade tennis scoring engine independent of DOM/UI.
 * Default arcade rules (PRD Section 12):
 * - First to 7 points wins a round (must win by 2)
 * - Best of 3 rounds (first to 2 rounds wins the match)
 */
export class TennisScoring {
  constructor(config = {}) {
    this.pointsToWinRound = config.pointsToWinRound ?? 7;
    this.winByMargin = config.winByMargin ?? 2;
    this.roundsToWinMatch = config.roundsToWinMatch ?? 2;

    this.resetMatch();
  }

  resetMatch() {
    this.playerPoints = 0;
    this.aiPoints = 0;
    this.playerRounds = 0;
    this.aiRounds = 0;
    this.currentRound = 1;
    this.roundHistory = [];
    this.server = 'player'; // 'player' | 'ai'
    this.matchWinner = null; // null | 'player' | 'ai'
  }

  /**
   * Returns 'deuce' (right side) when total points in current round are even,
   * or 'ad' (left side) when total points are odd.
   */
  getServeSide() {
    const totalPoints = this.playerPoints + this.aiPoints;
    return totalPoints % 2 === 0 ? 'deuce' : 'ad';
  }

  /**
   * Checks whether the upcoming point is a MATCH POINT or GAME (Round) POINT.
   */
  getPointSituation() {
    if (this.matchWinner) {
      return { isMatchPoint: false, isGamePoint: false, holder: null };
    }

    const pNext = this.playerPoints + 1;
    const aNext = this.aiPoints + 1;

    const playerCanWinRound =
      pNext >= this.pointsToWinRound && pNext - this.aiPoints >= this.winByMargin;
    const aiCanWinRound =
      aNext >= this.pointsToWinRound && aNext - this.playerPoints >= this.winByMargin;

    if (playerCanWinRound) {
      const isMatch = this.playerRounds + 1 >= this.roundsToWinMatch;
      return {
        isMatchPoint: isMatch,
        isGamePoint: !isMatch,
        holder: 'player'
      };
    }

    if (aiCanWinRound) {
      const isMatch = this.aiRounds + 1 >= this.roundsToWinMatch;
      return {
        isMatchPoint: isMatch,
        isGamePoint: !isMatch,
        holder: 'ai'
      };
    }

    return { isMatchPoint: false, isGamePoint: false, holder: null };
  }

  /**
   * Awards a point to 'player' or 'ai' and evaluates round/match completion.
   * Returns { pointWinner, roundEnded, roundWinner, matchEnded, matchWinner, server, serveSide }
   */
  awardPoint(winner) {
    if (this.matchWinner) {
      return {
        pointWinner: winner,
        roundEnded: false,
        roundWinner: null,
        matchEnded: true,
        matchWinner: this.matchWinner,
        server: this.server,
        serveSide: this.getServeSide()
      };
    }

    if (winner === 'player') {
      this.playerPoints += 1;
    } else {
      this.aiPoints += 1;
    }

    let roundEnded = false;
    let roundWinner = null;
    let matchEnded = false;

    const p = this.playerPoints;
    const a = this.aiPoints;

    if (
      (p >= this.pointsToWinRound || a >= this.pointsToWinRound) &&
      Math.abs(p - a) >= this.winByMargin
    ) {
      roundEnded = true;
      roundWinner = p > a ? 'player' : 'ai';

      this.roundHistory.push({
        round: this.currentRound,
        playerPoints: p,
        aiPoints: a,
        winner: roundWinner
      });

      if (roundWinner === 'player') {
        this.playerRounds += 1;
      } else {
        this.aiRounds += 1;
      }

      if (
        this.playerRounds >= this.roundsToWinMatch ||
        this.aiRounds >= this.roundsToWinMatch
      ) {
        matchEnded = true;
        this.matchWinner =
          this.playerRounds >= this.roundsToWinMatch ? 'player' : 'ai';
      } else {
        // Advance to next round and reset round points
        this.currentRound += 1;
        this.playerPoints = 0;
        this.aiPoints = 0;
      }
    }

    // Alternate server every 2 points (and flip at start of new round)
    const totalRoundPoints = this.playerPoints + this.aiPoints;
    if (roundEnded) {
      this.server = this.currentRound % 2 === 1 ? 'player' : 'ai';
    } else if (totalRoundPoints > 0 && totalRoundPoints % 2 === 0) {
      this.server = this.server === 'player' ? 'ai' : 'player';
    }

    return {
      pointWinner: winner,
      roundEnded,
      roundWinner,
      matchEnded,
      matchWinner: this.matchWinner,
      server: this.server,
      serveSide: this.getServeSide()
    };
  }

  getState() {
    const situation = this.getPointSituation();
    return {
      playerPoints: this.playerPoints,
      aiPoints: this.aiPoints,
      playerRounds: this.playerRounds,
      aiRounds: this.aiRounds,
      currentRound: this.currentRound,
      server: this.server,
      serveSide: this.getServeSide(),
      matchWinner: this.matchWinner,
      isMatchPoint: situation.isMatchPoint,
      isGamePoint: situation.isGamePoint,
      pointSituationHolder: situation.holder,
      roundHistory: [...this.roundHistory]
    };
  }
}
